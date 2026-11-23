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

/** `/preview/<ticket>/<path>?v=<load>` with each part of the path escaped, on the app at `baseUrl`. */
function previewAddress(call: { baseUrl: string; ticket: string; path: string; load: number }) {
  const escaped = call.path.split("/").map(encodeURIComponent).join("/");
  return `${call.baseUrl}/preview/${call.ticket}/${escaped}?v=${String(call.load)}`;
}

/** Where a worktree file can be shown as a web page. */
function previewApi(api: Api, baseUrl: string) {
  let loads = 0;
  return {
    /**
     * The address that shows a worktree file as a web page: an HTML file, or any file next to it
     * (`index.html` for a folder). Call it again to reload: every call returns a new address (a
     * new `?v=`), so an iframe shown the new address loads the page again. An address stops
     * working after an hour unused, when the session is archived, or when the app restarts. It
     * works only for this session and without the app's
     * credentials: load it in `<iframe sandbox="allow-scripts allow-forms">`. The app serves it
     * with a Content-Security-Policy that gives the page its own opaque origin, no access to the
     * API and no network requests. Throws ApiError "session-not-found" for an archived session.
     */
    previewUrl: async (id: SessionId, path: string): Promise<string> => {
      const { ticket } = await read(api.sessions[":id"].preview.$post({ param: { id } }));
      return previewAddress({ baseUrl, ticket, path, load: ++loads });
    },
  };
}

/** A session's worktree: list, read and write files, and the address to preview one. */
export function filesApi(api: Api, baseUrl: string) {
  return {
    ...previewApi(api, baseUrl),
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
