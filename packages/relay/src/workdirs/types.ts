import type { DiffResult, FsEntry } from "@agentcontrol/protocol";
import type { z } from "zod";

/** Where a session's agent works, as recorded in its `session-created` event. */
export interface WorkdirInfo {
  worktreePath: string;
  repoPath: string;
  baseBranch: string;
  /** Absent means "worktree". */
  kind?: "worktree" | "directory" | undefined;
}

/** What the relay does with a session's folder; one implementation per kind of folder. */
export interface Workdir {
  tree(): Promise<{ entries: z.infer<typeof FsEntry>[] }>;
  read(options: { path: string; ref: "base" | "head" | "working" }): Promise<{
    content: string;
    hash: string;
  }>;
  /** Fails for a folder without git: there is no base to compare with. */
  diff(): Promise<z.infer<typeof DiffResult>>;
  /** Files with changes that would be lost on removal. */
  uncommitted(): Promise<string[]>;
  /** Removes what the relay created for the session. The folder of a directory session stays. */
  remove(): Promise<void>;
}
