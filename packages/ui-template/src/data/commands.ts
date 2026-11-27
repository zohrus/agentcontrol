import type { SessionId, SessionRow } from "@agentcontrol/sdk";
import { attempt, type Context } from "./context.ts";
import { ActionFailed, uncommittedFilesOf } from "./errors.ts";
import type { DataState } from "./model.ts";
import { busyKey, setLeaving, whileBusy } from "./pending.ts";
import { isRow, keyOf, refOf, type SessionRef } from "./session-ref.ts";
import { untilStore } from "./store.ts";
import { loadSessions } from "./sessions-data.ts";

/** How an archive request ended: done, held back by unsaved changes, or failed (already reported). */
export type ArchiveOutcome =
  | { status: "archived" }
  | { status: "blocked"; files: readonly string[] }
  | { status: "failed" };

/** Starts a new agent for an interrupted session; it reads "Resuming…" until the app answers. */
export function resumeSession(ctx: Context, ref: SessionRef) {
  const key = busyKey("resume", keyOf(ref));
  return whileBusy(ctx, {
    key,
    work: () => attempt(ctx, () => ctx.client.sessions.resume(ref.id)),
  });
}

/** Asks the agent to stop its turn; the button reads "Cancelling…" until the app answers. */
export function cancelTurn(ctx: Context, ref: SessionRef) {
  const key = busyKey("cancel", keyOf(ref));
  return whileBusy(ctx, {
    key,
    work: () => attempt(ctx, () => ctx.client.sessions.cancel(ref.id)),
  });
}

/** Answers a permission request; the card says which answer is on its way until the app answers. */
export function answerPermission(
  ctx: Context,
  call: { id: SessionId; requestId: string; optionId: string },
) {
  return whileBusy(ctx, {
    key: busyKey("answer", call.requestId),
    choice: call.optionId,
    work: () => answerAndWait(ctx, call),
  });
}

const stillAsking = (requestId: string) => (state: DataState) =>
  state.sessions.some((row) => row.pendingPermissions.some((p) => p.requestId === requestId));

/** Sends the answer; it counts as on its way until the list no longer shows the request. */
async function answerAndWait(
  ctx: Context,
  call: { id: SessionId; requestId: string; optionId: string },
): Promise<void> {
  const { id, requestId, optionId } = call;
  const sent = await attempt(ctx, async () => {
    await ctx.client.sessions.answerPermission(id, requestId, optionId);
    return true;
  });
  if (sent) await untilStore(ctx.store, (state) => !stillAsking(requestId)(state));
}

/** The session is in the list again as it was, even when the list cannot be read right now. */
function putBack(ctx: Context, row: SessionRow): void {
  setLeaving(ctx, { ref: refOf(row), leaving: false });
  ctx.store.update((s) =>
    s.sessions.some((held) => isRow(held, refOf(row)))
      ? s
      : { ...s, sessions: [row, ...s.sessions] },
  );
}

/** Unsaved changes held the archive back (the files are listed); anything else is reported. */
function refusedArchive(ctx: Context, call: { row: SessionRow; error: unknown }): ArchiveOutcome {
  putBack(ctx, call.row);
  const files = uncommittedFilesOf(call.error);
  if (files !== undefined) return { status: "blocked", files };
  ctx.report(new ActionFailed(`Could not archive "${call.row.title}"`, call.error));
  return { status: "failed" };
}

/**
 * The archive request, with the session already out of the list. Afterwards it is back in the
 * list (archived, or as it was when the archive was refused or failed, which is then reported).
 */
async function archiveRequest(
  ctx: Context,
  call: { ref: SessionRef; force: boolean },
): Promise<ArchiveOutcome> {
  const { ref } = call;
  const row = ctx.store.get().sessions.find((held) => isRow(held, ref));
  setLeaving(ctx, { ref, leaving: true });
  try {
    await ctx.client.sessions.archive(ref.id, call.force ? { force: true } : {});
    return { status: "archived" };
  } catch (error) {
    return row === undefined ? { status: "failed" } : refusedArchive(ctx, { row, error });
  } finally {
    setLeaving(ctx, { ref, leaving: false });
    await loadSessions(ctx).catch(() => undefined);
  }
}

/**
 * Archives a session: it leaves every list at once, without waiting for the app. Without `force`,
 * unsaved changes in its worktree stop it and are listed. A second press does nothing.
 */
export async function archiveSession(
  ctx: Context,
  call: { ref: SessionRef; force: boolean },
): Promise<ArchiveOutcome> {
  const key = busyKey("archive", keyOf(call.ref));
  const outcome = await whileBusy(ctx, { key, work: () => archiveRequest(ctx, call) });
  return outcome ?? { status: "failed" };
}
