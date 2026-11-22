import type { SessionId } from "@agentcontrol/sdk";
import { loadFile, refreshChanges } from "./changes-data.ts";
import { type Context, inBackground } from "./context.ts";
import { loadEvents } from "./sessions-data.ts";

type Open = { id: SessionId | undefined; path: string | undefined };

const isArchived = (ctx: Context, session: SessionId): boolean =>
  ctx.store.get().sessions.find((row) => row.id === session)?.status === "archived";

/** Archived sessions have no worktree to read. */
async function reloadChanges(ctx: Context, open: Open): Promise<void> {
  const { id, path } = open;
  if (id === undefined || isArchived(ctx, id)) return;
  await refreshChanges(ctx, id);
  if (path !== undefined) await loadFile(ctx, { id, path });
}

async function reloadAll(ctx: Context, open: Open): Promise<void> {
  if (open.id === undefined) return;
  await Promise.all([loadEvents(ctx, open.id), reloadChanges(ctx, open)]);
}

/**
 * Remembers which session and which file the user has open, and reloads what they show when the
 * app reconnects or reports that files changed.
 */
export function createSelection(ctx: Context) {
  const open: Open = { id: undefined, path: undefined };
  return {
    select: (id: SessionId | undefined): void => {
      // A file the pane already opened for this session (its effect runs first) stays open.
      Object.assign(open, { id, path: id === open.id ? open.path : undefined });
      inBackground(ctx, reloadAll(ctx, open));
    },
    openFile: (call: { id: SessionId; path: string | undefined }): void => {
      Object.assign(open, call);
      if (call.path !== undefined)
        inBackground(ctx, loadFile(ctx, { id: call.id, path: call.path }));
    },
    reloadAll: (): void => {
      inBackground(ctx, reloadAll(ctx, open));
    },
    filesChanged: (sessionId: SessionId): void => {
      if (sessionId === open.id) inBackground(ctx, reloadChanges(ctx, open));
    },
  };
}
