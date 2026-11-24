import { join } from "node:path";
import type { RepoSetup } from "@agentcontrol/protocol";
import { git } from "../git/index.ts";
import { copyFiles } from "./copy-files.ts";
import { latestTrunk, type StartPoint } from "./start-point.ts";

/** A named branch is used as it is; without one the latest remote trunk is. */
function resolveStartPoint(options: {
  repoPath: string;
  baseBranch?: string | undefined;
}): Promise<StartPoint> {
  const named = options.baseBranch?.trim() ?? "";
  if (named !== "") return Promise.resolve({ ref: named, notes: [] });
  return latestTrunk(options.repoPath);
}

export interface CreatedWorktree {
  worktreePath: string;
  branch: string;
  /** What the worktree started from, e.g. "origin/main"; the session's diff compares with it. */
  baseBranch: string;
  /** Sentences for the session's setup output about where it started from. */
  notes: string[];
  env: Record<string, string>;
}

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

/**
 * Adds a worktree on a new branch, copies the setup files and assigns the ports. It starts from
 * `baseBranch`, or, when that is left out, from the latest trunk of the remote.
 */
export async function createWorktree(options: {
  repoPath: string;
  baseBranch?: string | undefined;
  sessionId: string;
  worktreesDir: string;
  setup: RepoSetup;
  portBase: number;
}): Promise<CreatedWorktree> {
  const branch = `agentcontrol/${options.sessionId}`;
  const worktreePath = join(options.worktreesDir, options.sessionId);
  const start = await resolveStartPoint(options);
  const args = ["worktree", "add", "--no-track", "-b", branch, worktreePath, start.ref];
  await git(args, { cwd: options.repoPath });
  await copyFiles({
    repoPath: options.repoPath,
    worktreePath,
    patterns: options.setup.copyFiles,
  });
  const { ref: baseBranch, notes } = start;
  return { worktreePath, branch, baseBranch, notes, env: portEnv(options.portBase) };
}
