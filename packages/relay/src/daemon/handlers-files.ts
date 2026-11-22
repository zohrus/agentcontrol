import { ErrorCode, RelayName as N } from "@agentcontrol/protocol";
import { fileTree, readFileAt, watchFiles, writeFileIfUnchanged } from "../files/index.ts";
import { RelayError, type Handlers } from "../rpc/index.ts";
import type { Sessions } from "../sessions/index.ts";
import { diffWorktree } from "../worktrees/index.ts";

type FileMethods =
  | typeof N.diff
  | typeof N.fsTree
  | typeof N.fsRead
  | typeof N.fsWrite
  | typeof N.fsWatch;

/** The methods that look into a session's worktree: diff, file tree, read, write, watch. */
export function fileHandlers(sessions: Sessions): Pick<Handlers, FileMethods> {
  return {
    [N.diff]: async ({ sessionId }) => diffWorktree(await sessions.info(sessionId)),
    [N.fsTree]: async ({ sessionId }) => fileTree((await sessions.info(sessionId)).worktreePath),
    [N.fsRead]: async ({ sessionId, path, ref }) =>
      readFileAt({ ...(await sessions.info(sessionId)), path, ref }),
    [N.fsWrite]: async ({ sessionId, path, content, expectedHash }) => {
      const { worktreePath } = await sessions.info(sessionId);
      const written = await writeFileIfUnchanged({ worktreePath, path, content, expectedHash });
      if ("stale" in written) {
        const message = `"${path}" changed since you read it, so it was not overwritten.`;
        throw new RelayError(ErrorCode.staleFile, message, { currentHash: written.currentHash });
      }
      return written;
    },
    [N.fsWatch]: async ({ sessionId }, client) => {
      const { worktreePath } = await sessions.info(sessionId);
      const stop = watchFiles(worktreePath, (paths) => {
        client.notify(N.fsChanged, { sessionId, paths });
      });
      client.onClose(stop);
      return {};
    },
  };
}
