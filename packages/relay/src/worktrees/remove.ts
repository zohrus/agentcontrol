import { git } from "../git/index.ts";

/** Removes the worktree folder and its git registration; the branch and its commits stay. */
export async function removeWorktree(options: {
  repoPath: string;
  worktreePath: string;
}): Promise<void> {
  await git(["worktree", "remove", "--force", options.worktreePath], { cwd: options.repoPath });
}
