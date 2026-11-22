import { join } from "node:path";
import type { RepoSetup } from "@agentcontrol/protocol";
import { git } from "../git/index.ts";
import { copyFiles } from "./copy-files.ts";
import { type OutputHandler, runSetupScript } from "./setup-script.ts";

export interface CreatedWorktree {
  worktreePath: string;
  branch: string;
  env: Record<string, string>;
  setupExitCode: number;
}

const PORT_START = 41000;
const PORT_BLOCK = 10;

/** The first port of the index-th block of 10 ports, starting at 41000. */
export function portBaseFor(index: number): number {
  return PORT_START + index * PORT_BLOCK;
}

/** Order: add a worktree on a new branch from baseBranch, copy files, assign ports, run setup. */
export async function createWorktree(options: {
  repoPath: string;
  baseBranch: string;
  sessionId: string;
  worktreesDir: string;
  setup: RepoSetup;
  portBase: number;
  onSetupOutput: OutputHandler;
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
  const port = String(options.portBase);
  const env = { PORT: port, AGENTCONTROL_PORT_BASE: port };
  const setupExitCode = await runSetupScript({
    script: options.setup.setupScript,
    cwd: worktreePath,
    env,
    onOutput: options.onSetupOutput,
  });
  return { worktreePath, branch, env, setupExitCode };
}
