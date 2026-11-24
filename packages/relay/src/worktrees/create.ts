import { join } from "node:path";
import type { RepoSetup } from "@agentcontrol/protocol";
import { git } from "../git/index.ts";
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
}): Promise<StartPoint> {
  const named = namedBase(options.baseBranch);
  if (named !== "") return Promise.resolve({ ref: named, notes: [] });
  return latestTrunk(options.repoPath);
}

/** Adds the worktree on a new branch at `startRef`, then copies the setup files into it. */
export async function addWorktree(options: {
  repoPath: string;
  planned: PlannedWorktree;
  startRef: string;
  setup: RepoSetup;
}): Promise<void> {
  const { repoPath, planned, startRef } = options;
  const { branch, worktreePath } = planned;
  await git(["worktree", "add", "--no-track", "-b", branch, worktreePath, startRef], {
    cwd: repoPath,
  });
  await copyFiles({ repoPath, worktreePath, patterns: options.setup.copyFiles });
}
