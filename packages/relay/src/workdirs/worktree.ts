import { access } from "node:fs/promises";
import { fileTree, readFileAt } from "../files/index.ts";
import { diffWorktree, removeWorktree, uncommittedFiles } from "../worktrees/index.ts";
import type { Workdir, WorkdirInfo } from "./types.ts";

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/** A session's own git worktree: every operation is a git operation. */
export function worktreeWorkdir(info: WorkdirInfo): Workdir {
  const { worktreePath, repoPath, baseBranch } = info;
  return {
    tree: () => fileTree(worktreePath),
    read: (options) => readFileAt({ worktreePath, baseBranch, ...options }),
    diff: () => diffWorktree({ worktreePath, baseBranch }),
    uncommitted: async () => ((await exists(worktreePath)) ? uncommittedFiles(worktreePath) : []),
    remove: async () => {
      if (await exists(worktreePath)) await removeWorktree({ repoPath, worktreePath });
    },
  };
}
