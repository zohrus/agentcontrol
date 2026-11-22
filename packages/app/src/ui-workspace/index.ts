import { mkdir, realpath, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { UiVersion, UiVersions } from "../ui-versions/index.ts";
import { type CheckResult, type RunCommand, runChecks, runWithBun } from "./checks.ts";
import { assertInside, exists, plan, syncDir } from "./files.ts";

export type { CheckResult, RunCommand } from "./checks.ts";

export interface UiWorkspace {
  readonly liveDir: string;
  readonly stagingDir: string;
  /** First run: copies the template into live and staging, links dependencies, and initialises the version history. Later runs: no-op. */
  ensureReady(): Promise<void>;
  /** Runs typecheck then build in staging. Never throws for a failing check; returns the output for the agent. */
  runChecks(): Promise<CheckResult>;
  /** Copies staging to live in one step (only changed files are written, deleted files are removed), so the dev server reloads once. Returns the changed paths. */
  promote(): Promise<string[]>;
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
  runCommand?: RunCommand;
}

/**
 * Dependencies: users have no package manager and the Modify agent may not run `npm install`, so
 * node_modules comes from the app: a symlink to the template package's own node_modules. It is
 * never copied or committed (the history skips node_modules, dist and dot-folders).
 */
async function linkDependencies(options: { templateDir: string; dir: string }): Promise<void> {
  const link = join(options.dir, "node_modules");
  if (await exists(link)) return;
  await mkdir(options.dir, { recursive: true });
  await symlink(await realpath(join(options.templateDir, "node_modules")), link, "dir");
}

interface Context {
  dataDir: string;
  templateDir: string;
  templateVersion: string;
  versions: UiVersions;
  liveDir: string;
  stagingDir: string;
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
  if (await exists(join(ctx.liveDir, "node_modules"))) return;
  await ctx.versions.init(ctx);
  await checkoutBoth(ctx);
  await linkDependencies({ templateDir: ctx.templateDir, dir: ctx.stagingDir });
  await linkDependencies({ templateDir: ctx.templateDir, dir: ctx.liveDir });
}

async function moveHistory(ctx: Context, move: () => Promise<UiVersion | undefined>) {
  await guard(ctx);
  const version = await move();
  if (version) await checkoutBoth(ctx);
  return version;
}

async function pendingChanges(ctx: Context): Promise<string[]> {
  const { write, remove } = await plan({ from: ctx.stagingDir, to: ctx.liveDir });
  return [...write, ...remove].sort();
}

async function resetToKept(ctx: Context): Promise<void> {
  await guard(ctx);
  await checkoutBoth(ctx);
}

async function discardStaging(ctx: Context): Promise<void> {
  await guard(ctx);
  await syncDir({ from: ctx.liveDir, to: ctx.stagingDir });
}

export function createUiWorkspace(options: UiWorkspaceOptions): UiWorkspace {
  const run = options.runCommand ?? runWithBun;
  const ctx: Context = {
    ...options,
    liveDir: resolve(options.dataDir, "ui"),
    stagingDir: resolve(options.dataDir, "ui-staging"),
  };
  const { liveDir, stagingDir, versions } = ctx;
  return {
    liveDir,
    stagingDir,
    ensureReady: () => ensureReady(ctx),
    runChecks: () => runChecks({ stagingDir, run }),
    promote: async () => {
      await guard(ctx);
      return syncDir({ from: stagingDir, to: liveDir });
    },
    keep: (request) => versions.keep({ dir: liveDir, request }),
    undo: () => moveHistory(ctx, () => versions.undo()),
    restore: async (commit) => {
      const version = await moveHistory(ctx, () => versions.restore(commit));
      return version as UiVersion;
    },
    resetToKept: () => resetToKept(ctx),
    discardStaging: () => discardStaging(ctx),
    pendingChanges: () => pendingChanges(ctx),
  };
}
