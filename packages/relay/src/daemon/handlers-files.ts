import { ErrorCode, RelayName as N, type SessionId } from "@agentcontrol/protocol";
import { readBytes, watchFiles, writeFileIfUnchanged } from "../files/index.ts";
import { RelayError, type Handlers } from "../rpc/index.ts";
import type { Sessions } from "../sessions/index.ts";
import { workdirOf } from "../workdirs/index.ts";

type FileMethods =
  | typeof N.diff
  | typeof N.fsTree
  | typeof N.fsRead
  | typeof N.fsReadBytes
  | typeof N.fsWrite
  | typeof N.fsWatch;

/**
 * Starts reporting changes to the session's files to the client that asked. A session just created
 * has no folder yet: the watch starts when it has, and this answers at once.
 */
function watchHandler(sessions: Sessions): Handlers[typeof N.fsWatch] {
  return async ({ sessionId }, client) => {
    const { worktreePath } = await sessions.info(sessionId);
    const waiting = sessions.lacksWorktree(sessionId);
    let stop = (): void => undefined;
    let closed = false;
    void sessions
      .worktreeMade(sessionId)
      .then((made) => {
        if (!made || closed) return;
        stop = watchFiles(worktreePath, (paths) => {
          client.notify(N.fsChanged, { sessionId, paths });
        });
        // What the client read while there was no folder was empty: it reads again (no paths: all).
        if (waiting) client.notify(N.fsChanged, { sessionId, paths: [] });
      })
      // A folder that is gone (the session was archived meanwhile) has nothing to watch.
      .catch((error: unknown) => {
        console.error(`Could not watch the files of session ${sessionId}: ${String(error)}`);
      });
    client.onClose(() => {
      closed = true;
      stop();
    });
    return {};
  };
}

/** The session's location once its worktree exists; refuses when it could not be made. */
async function madeSession(sessions: Sessions, sessionId: SessionId) {
  const info = await sessions.info(sessionId);
  if (!(await sessions.worktreeMade(sessionId))) {
    throw new RelayError(ErrorCode.setupFailed, "The session's working copy could not be made.");
  }
  return info;
}

/** What a session without a worktree answers with, instead of failing: nothing. */
const NO_CHANGES = { baseCommit: "", files: [], patch: "" };
const NO_FILES = { entries: [] };

/** The session's folder operations, and whether its worktree is missing (being made, or not made). */
async function lookingInto(sessions: Sessions, sessionId: SessionId) {
  const workdir = workdirOf(await sessions.info(sessionId));
  return { workdir, lacking: sessions.lacksWorktree(sessionId) };
}

async function readOf(sessions: Sessions, call: Parameters<Handlers[typeof N.fsRead]>[0]) {
  const { workdir, lacking } = await lookingInto(sessions, call.sessionId);
  if (lacking) {
    throw new RelayError(ErrorCode.fileNotFound, "The session has no working copy.");
  }
  return workdir.read({ path: call.path, ref: call.ref });
}

/** The methods that look into a session's worktree: diff, file tree, read, write, watch. */
export function fileHandlers(sessions: Sessions): Pick<Handlers, FileMethods> {
  return {
    [N.diff]: async ({ sessionId }) => {
      const { workdir, lacking } = await lookingInto(sessions, sessionId);
      return lacking ? NO_CHANGES : workdir.diff();
    },
    [N.fsTree]: async ({ sessionId }) => {
      const { workdir, lacking } = await lookingInto(sessions, sessionId);
      return lacking ? NO_FILES : workdir.tree();
    },
    [N.fsRead]: (call) => readOf(sessions, call),
    [N.fsReadBytes]: async ({ sessionId, path }) =>
      readBytes({ worktreePath: (await madeSession(sessions, sessionId)).worktreePath, path }),
    [N.fsWrite]: async ({ sessionId, path, content, expectedHash }) => {
      const { worktreePath } = await madeSession(sessions, sessionId);
      const written = await writeFileIfUnchanged({ worktreePath, path, content, expectedHash });
      if ("stale" in written) {
        const message = `"${path}" changed since you read it, so it was not overwritten.`;
        throw new RelayError(ErrorCode.staleFile, message, { currentHash: written.currentHash });
      }
      return written;
    },
    [N.fsWatch]: watchHandler(sessions),
  };
}
