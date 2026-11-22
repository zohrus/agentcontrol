import { git, parseStatus } from "../git/index.ts";

/** Paths with uncommitted changes (modified, staged or untracked). */
export async function uncommittedFiles(worktreePath: string): Promise<string[]> {
  const output = await git(["status", "--porcelain=v1", "-z", "-uall"], { cwd: worktreePath });
  return parseStatus(output).map((entry) => entry.path);
}
