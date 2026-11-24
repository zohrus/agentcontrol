import type { Context } from "./context.ts";
import type { DataState } from "./model.ts";
import { applyModify } from "./modify-data.ts";
import { forgetReload } from "./recover.ts";
import { applyEvent, applySummaries } from "./sessions-data.ts";
import type { SessionRef } from "./session-ref.ts";
import { applyProgress } from "./setup-progress.ts";
import { applyWorkspace } from "./workspaces-data.ts";

/** Paths that changed in a session's worktree. */
export type FileChange = { ref: SessionRef; paths: readonly string[] };

type Handlers = {
  /** The stream (re)connected: refetch what is shown, since messages may have been missed. */
  resync: () => void;
  filesChanged: (change: FileChange) => void;
};

function setConnection(ctx: Context, connection: DataState["connection"]): void {
  ctx.store.update((s) => (s.connection === connection ? s : { ...s, connection }));
}

/** Applies the app's live messages to the state. Returns the function that stops listening. */
export function startLive(ctx: Context, handlers: Handlers): () => void {
  return ctx.client.subscribe({
    onOpen: () => {
      forgetReload();
      setConnection(ctx, "connected");
      handlers.resync();
    },
    onClose: () => {
      setConnection(ctx, "reconnecting");
    },
    onEvent: (event) => {
      applyEvent(ctx, event);
    },
    onSessions: (summaries) => {
      applySummaries(ctx, summaries);
    },
    onModify: (state) => {
      applyModify(ctx, state);
    },
    onWorkspace: (workspace) => {
      applyWorkspace(ctx, workspace);
    },
    onWorkspaceProgress: (progress) => {
      applyProgress(ctx, progress);
    },
    onFilesChanged: ({ workspaceId, sessionId, paths }) => {
      handlers.filesChanged({ ref: { workspaceId, id: sessionId }, paths });
    },
  });
}
