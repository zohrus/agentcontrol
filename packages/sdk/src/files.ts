import type { FsEntry, SessionId } from "@agentcontrol/protocol";
import { ApiError, read } from "./api-error.ts";
import type { Api } from "./client-type.ts";

/** Which version of a file: the base branch, the last commit, or what is on disk now. */
export type FileRef = "base" | "head" | "working";

export interface FileContent {
  content: string;
  /** Pass this back as `expectedHash` when writing, to detect changes made meanwhile. */
  hash: string;
}

export interface WriteFile {
  id: SessionId;
  path: string;
  content: string;
  /** The hash from the read this edit is based on. */
  expectedHash: string;
}

/** A session's worktree: list, read and write files. */
export function filesApi(api: Api) {
  return {
    /** Every file and folder in the worktree, with git status. Also starts live change events. */
    tree: async (id: SessionId): Promise<FsEntry[]> => {
      const { entries } = await read(api.sessions[":id"].files.$get({ param: { id } }));
      return entries;
    },
    /** One file at a ref (default "working"), with the hash to pass to `write`. */
    read: async (options: { id: SessionId; path: string; ref?: FileRef }): Promise<FileContent> => {
      const { id, path, ref = "working" } = options;
      return read(api.sessions[":id"].file.$get({ param: { id }, query: { path, ref } }));
    },
    /**
     * Saves a file if it still matches `expectedHash`. Resolves with the new hash. Throws ApiError
     * "stale-file" (status 409, data.currentHash) when the file changed since it was read.
     */
    write: async ({ id, ...body }: WriteFile): Promise<string> => {
      const { hash } = await read(api.sessions[":id"].file.$put({ param: { id }, json: body }));
      return hash;
    },
  };
}

/** True when the error means a file changed since it was read. */
export const isStaleFile = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.code === "stale-file";
