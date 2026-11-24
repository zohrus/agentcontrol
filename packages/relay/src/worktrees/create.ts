import { join } from "node:path";
import type { RepoSetup } from "@agentcontrol/protocol";
import { git } from "../git/index.ts";
import type { Timed } from "../steps/index.ts";
import { copyFiles } from "./copy-files.ts";
import { latestTrunk, refExists, type StartPoint } from "./start-point.ts";

/** Where a session's worktree will be, known before anything is made: it only depends on the id. */
export interface PlannedWorktree {
  worktreePath: string;
  branch: string;
  /** First port of the session's block of 10. */
  portBase: number;
  env: Record<string, string>;
}

/** The base branch the user named, trimmed; empty when they named none. */
export const namedBase = (baseBranch: string | undefined): string => baseBranch?.trim() ?? "";

const PORT_START = 41000;
const PORT_BLOCK = 10;

/** The first port of the index-th block of 10 ports, starting at 41000. */
export function portBaseFor(index: number): number {
  return PORT_START + index * PORT_BLOCK;
}

/** The variables of a session's block of ports, for its setup script, agent and terminal. */
export function portEnv(portBase: number): Record<string, string> {
  const port = String(portBase);
  return { PORT: port, AGENTCONTROL_PORT_BASE: port };
}

/** The folder, branch and ports of a session's worktree, worked out without touching git. */
export function planWorktree(options: {
  sessionId: string;
  worktreesDir: string;
  portBase: number;
}): PlannedWorktree {
  const { sessionId } = options;
  return {
    worktreePath: join(options.worktreesDir, sessionId),
    branch: `agentcontrol/${sessionId}`,
    portBase: options.portBase,
    env: portEnv(options.portBase),
  };
}

/** Refuses a base branch git does not know, in git's own words (checked locally, so it is quick). */
export async function checkBaseBranch(repoPath: string, branch: string): Promise<void> {
  if (!(await refExists(repoPath, branch))) throw new Error(`invalid reference: ${branch}`);
}

/** What the worktree starts from: the named branch as it is, else the latest remote trunk. */
export function resolveStartPoint(options: {
  repoPath: string;
  baseBranch?: string | undefined;
  timed: Timed;
}): Promise<StartPoint> {
  const named = namedBase(options.baseBranch);
  if (named !== "") return Promise.resolve({ ref: named, notes: [] });
  return latestTrunk({ repoPath: options.repoPath, timed: options.timed });
}

/** How many files git tracks in the folder: what a checkout just wrote. */
async function trackedCount(worktreePath: string): Promise<number> {
  const names = await git(["ls-files", "-z"], { cwd: worktreePath });
  return names.split("\0").length - 1;
}

const plural = (count: number, noun: string): string =>
  `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;

/** `git worktree add` with the checkout done on every core (`checkout.workers=0`): several times faster on a big repository. */
async function checkOut(call: {
  repoPath: string;
  branch: string;
  worktreePath: string;
  startRef: string;
}): Promise<void> {
  const { repoPath, branch, worktreePath, startRef } = call;
  const env = {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "checkout.workers",
    GIT_CONFIG_VALUE_0: "0",
  };
  const args = ["worktree", "add", "--no-track", "-b", branch, worktreePath, startRef];
  await git(args, { cwd: repoPath, env });
}

/** Adds the worktree on a new branch at `startRef`, then copies the setup files into it. */
export async function addWorktree(options: {
  repoPath: string;
  planned: PlannedWorktree;
  startRef: string;
  setup: RepoSetup;
  timed: Timed;
}): Promise<void> {
  const { repoPath, planned, startRef, timed } = options;
  const { branch, worktreePath } = planned;
  const checkout = {
    id: "checkout",
    doing: `Checking out ${startRef}`,
    done: (count: number) => `Checked out ${plural(count, "file")}`,
  };
  await timed(checkout, async () => {
    await checkOut({ repoPath, branch, worktreePath, startRef });
    return trackedCount(worktreePath);
  });
  const copy = {
    id: "copy",
    doing: "Copying the setup files",
    done: (copied: string[]) => `Copied ${plural(copied.length, "setup file")}`,
  };
  await timed(copy, () => copyFiles({ repoPath, worktreePath, patterns: options.setup.copyFiles }));
}
