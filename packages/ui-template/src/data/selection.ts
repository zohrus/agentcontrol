import { loadFile, refreshChanges } from "./changes-data.ts";
import { type Context, inBackground } from "./context.ts";
import { isCreating } from "./pending.ts";
import { loadEvents } from "./sessions-data.ts";
import { isRow, keyOf, sameSession, type SessionRef } from "./session-ref.ts";

type Open = { ref: SessionRef | undefined; path: string | undefined };

const isArchived = (ctx: Context, ref: SessionRef): boolean =>
  ctx.store.get().sessions.find((row) => isRow(row, ref))?.status === "archived";

/** Archived sessions have no worktree to read. */
async function reloadChanges(ctx: Context, open: Open): Promise<void> {
  const { ref, path } = open;
  if (ref === undefined || isArchived(ctx, ref) || isCreating(ctx, keyOf(ref))) return;
  await refreshChanges(ctx, ref);
  if (path !== undefined) await loadFile(ctx, { ref, path });
}

async function reloadAll(ctx: Context, open: Open): Promise<void> {
  if (open.ref === undefined) return;
  await Promise.all([loadEvents(ctx, open.ref), reloadChanges(ctx, open)]);
}

/**
 * Remembers which session and which file the user has open, and reloads what they show when the
 * app reconnects or reports that files changed.
 */
export function createSelection(ctx: Context) {
  const open: Open = { ref: undefined, path: undefined };
  return {
    select: (ref: SessionRef | undefined): void => {
      // A file the pane already opened for this session (its effect runs first) stays open.
      Object.assign(open, { ref, path: sameSession(ref, open.ref) ? open.path : undefined });
      inBackground(ctx, reloadAll(ctx, open));
    },
    openFile: (call: { ref: SessionRef; path: string | undefined }): void => {
      Object.assign(open, call);
      if (call.path !== undefined)
        inBackground(ctx, loadFile(ctx, { ref: call.ref, path: call.path }));
    },
    /** The app has taken a session this UI created: load its history, and its changes if it is open. */
    created: (ref: SessionRef): void => {
      inBackground(ctx, loadEvents(ctx, ref));
      if (sameSession(ref, open.ref)) inBackground(ctx, reloadChanges(ctx, open));
    },
    reloadAll: (): void => {
      inBackground(ctx, reloadAll(ctx, open));
    },
    filesChanged: (ref: SessionRef): void => {
      if (sameSession(ref, open.ref)) inBackground(ctx, reloadChanges(ctx, open));
    },
  };
}
