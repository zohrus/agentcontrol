import { git, parseStatus } from "../git/index.ts";

/**
 * Paths with uncommitted changes (modified, staged or untracked). Ignored files and folders are
 * never listed and never walked, however big (a `node_modules` is the usual one; measured: 50,000
 * ignored files add nothing to the check). `GIT_OPTIONAL_LOCKS=0` keeps this check from rewriting
 * the index the agent may be using at the same time.
 */
export async function uncommittedFiles(worktreePath: string): Promise<string[]> {
  const args = ["status", "--porcelain=v1", "-z", "-uall"];
  const output = await git(args, { cwd: worktreePath, env: { GIT_OPTIONAL_LOCKS: "0" } });
  return parseStatus(output).map((entry) => entry.path);
}
