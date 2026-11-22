import { directoryWorkdir } from "./directory.ts";
import type { Workdir, WorkdirInfo } from "./types.ts";
import { worktreeWorkdir } from "./worktree.ts";

export type { Workdir, WorkdirInfo } from "./types.ts";

/** The folder operations of a session: git worktree (the default) or plain directory. */
export function workdirOf(info: WorkdirInfo): Workdir {
  return info.kind === "directory" ? directoryWorkdir(info) : worktreeWorkdir(info);
}
