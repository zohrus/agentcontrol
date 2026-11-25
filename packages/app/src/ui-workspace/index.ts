import { mkdir, readlink, realpath, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { UiVersion, UiVersions } from "../ui-versions/index.ts";
import {
  type BuildUi,
  type CheckResult,
  type RunCommand,
  runChecks,
  runWithBun,
} from "./checks.ts";
import { assertInside, exists, plan, syncDir } from "./files.ts";

export type { CheckResult, RunCommand } from "./checks.ts";
export { contentKey } from "./files.ts";

export interface UiWorkspace {
  readonly liveDir: string;
  readonly stagingDir: string;
  /** First run: copies the template into live and staging, links dependencies, and initialises the version history. Later runs: no-op. */
  ensureReady(): Promise<void>;
  /** Runs typecheck then build in staging. Never throws for a failing check; returns the output for the agent. */
  runChecks(): Promise<CheckResult>;
  /** Copies staging to live in one step (only changed files are written, deleted files are removed), so the dev server reloads once. Returns the changed paths. */
  promote(): Promise<string[]>;
  /** Makes the UI that is served match the live folder (a no-op when it does; never throws). */
  serveLive(): Promise<void>;
  /** Keep: commits live to the history with the user's request, and returns the version. */
  keep(request: string): Promise<UiVersion | undefined>;
  /** Undo / restore: moves history, then writes that version into both live and staging. */
  undo(): Promise<UiVersion | undefined>;
  restore(commit: string): Promise<UiVersion>;
  /** Undo for a change that was promoted but not kept: writes the tip of the history into live and staging. */
  resetToKept(): Promise<void>;
  /** Throws away uncommitted staging edits by resetting staging to the live content. */
  discardStaging(): Promise<void>;
  /** Paths that differ between staging and live. */
  pendingChanges(): Promise<string[]>;
}

interface UiWorkspaceOptions {
  dataDir: string;
  templateDir: string;
  templateVersion: string;
  versions: UiVersions;
  /** Builds the UI of a folder: the build step of the checks. */
  buildUi: BuildUi;
  /** Called after the live folder changed, so the UI that is served follows it. */
  liveChanged: () => Promise<void>;
  runCommand?: RunCommand;
}

/**
 * Dependencies: users have no package manager and the Modify agent may not run `npm install`, so
 * node_modules comes from the app: a symlink to the template package's own node_modules. It is
 * never copied or committed (the history skips node_modules, dist and dot-folders). Every start
 * points the link at this release's folder, so moving or updating the app does not break it.
 */
async function linkDependencies(options: { templateDir: string; dir: string }): Promise<void> {
  const link = join(options.dir, "node_modules");
  const target = await realpath(join(options.templateDir, "node_modules"));
  const current = await readlink(link).catch(() => undefined);
  // Already right, or a real folder that someone put there: leave both alone.
  if (current === target || (current === undefined && (await exists(link)))) return;
  await mkdir(options.dir, { recursive: true });
  await rm(link, { force: true });
  await symlink(target, link, "dir");
}

interface Context {
  dataDir: string;
  templateDir: string;
  templateVersion: string;
  versions: UiVersions;
  liveDir: string;
  stagingDir: string;
  liveChanged: () => Promise<void>;
}

async function guard(ctx: Context): Promise<void> {
  await assertInside({ dataDir: ctx.dataDir, dir: ctx.liveDir });
  await assertInside({ dataDir: ctx.dataDir, dir: ctx.stagingDir });
}

async function checkoutBoth(ctx: Context): Promise<void> {
  await ctx.versions.checkout(ctx.liveDir);
  await ctx.versions.checkout(ctx.stagingDir);
}

async function ensureReady(ctx: Context): Promise<void> {
  await guard(ctx);
  // The live node_modules link is created last, so it marks a finished first run.
  if (!(await exists(join(ctx.liveDir, "node_modules")))) {
    await ctx.versions.init(ctx);
    await checkoutBoth(ctx);
  }
  await linkDependencies({ templateDir: ctx.templateDir, dir: ctx.stagingDir });
  await linkDependencies({ templateDir: ctx.templateDir, dir: ctx.liveDir });
}

async function moveHistory(ctx: Context, move: () => Promise<UiVersion | undefined>) {
  await guard(ctx);
  const version = await move();
  if (version) {
    await checkoutBoth(ctx);
    await ctx.liveChanged();
  }
  return version;
}

async function pendingChanges(ctx: Context): Promise<string[]> {
  const { write, remove } = await plan({ from: ctx.stagingDir, to: ctx.liveDir });
  return [...write, ...remove].sort();
}

async function resetToKept(ctx: Context): Promise<void> {
  await guard(ctx);
  await checkoutBoth(ctx);
  await ctx.liveChanged();
}

async function discardStaging(ctx: Context): Promise<void> {
  await guard(ctx);
  await syncDir({ from: ctx.liveDir, to: ctx.stagingDir });
}

async function promote(ctx: Context): Promise<string[]> {
  await guard(ctx);
  const changed = await syncDir({ from: ctx.stagingDir, to: ctx.liveDir });
  await ctx.liveChanged();
  return changed;
}

async function keep(ctx: Context, request: string): Promise<UiVersion | undefined> {
  const version = await ctx.versions.keep({ dir: ctx.liveDir, request });
  await ctx.liveChanged();
  return version;
}

export function createUiWorkspace(options: UiWorkspaceOptions): UiWorkspace {
  const run = options.runCommand ?? runWithBun;
  const ctx: Context = {
    ...options,
    liveDir: resolve(options.dataDir, "ui"),
    stagingDir: resolve(options.dataDir, "ui-staging"),
  };
  const { liveDir, stagingDir } = ctx;
  return {
    liveDir,
    stagingDir,
    ensureReady: () => ensureReady(ctx),
    runChecks: () => runChecks({ stagingDir, run, buildUi: options.buildUi }),
    promote: () => promote(ctx),
    serveLive: () => ctx.liveChanged(),
    keep: (request) => keep(ctx, request),
    undo: () => moveHistory(ctx, () => ctx.versions.undo()),
    restore: async (commit) => {
      const version = await moveHistory(ctx, () => ctx.versions.restore(commit));
      return version as UiVersion;
    },
    resetToKept: () => resetToKept(ctx),
    discardStaging: () => discardStaging(ctx),
    pendingChanges: () => pendingChanges(ctx),
  };
}
