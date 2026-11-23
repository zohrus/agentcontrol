import { join } from "node:path";
import type { RepoSetup } from "@agentcontrol/protocol";
import { git } from "../git/index.ts";
import { copyFiles } from "./copy-files.ts";

export interface CreatedWorktree {
  worktreePath: string;
  branch: string;
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

/** Adds a worktree on a new branch from baseBranch, copies the setup files and assigns the ports. */
export async function createWorktree(options: {
  repoPath: string;
  baseBranch: string;
  sessionId: string;
  worktreesDir: string;
  setup: RepoSetup;
  portBase: number;
}): Promise<CreatedWorktree> {
  const branch = `agentcontrol/${options.sessionId}`;
  const worktreePath = join(options.worktreesDir, options.sessionId);
  const args = ["worktree", "add", "-b", branch, worktreePath, options.baseBranch];
  await git(args, { cwd: options.repoPath });
  await copyFiles({
    repoPath: options.repoPath,
    worktreePath,
    patterns: options.setup.copyFiles,
  });
  return { worktreePath, branch, env: portEnv(options.portBase) };
}
