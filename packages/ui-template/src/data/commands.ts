import type { SessionId } from "@agentcontrol/sdk";
import { attempt, type Context } from "./context.ts";
import { uncommittedFilesOf } from "./errors.ts";
import type { DataState } from "./model.ts";
import { busyKey, whileBusy } from "./pending.ts";
import { keyOf, type SessionRef } from "./session-ref.ts";
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

async function archiveRequest(
  ctx: Context,
  call: { ref: SessionRef; force: boolean },
): Promise<ArchiveOutcome> {
  try {
    await ctx.client.sessions.archive(call.ref.id, call.force ? { force: true } : {});
    // "Archiving…" stays until the list says archived, so the button does not flicker back.
    await loadSessions(ctx).catch(() => undefined);
    return { status: "archived" };
  } catch (error) {
    const files = uncommittedFilesOf(error);
    if (files !== undefined) return { status: "blocked", files };
    ctx.report(error);
    return { status: "failed" };
  }
}

/**
 * Archives a session; without `force`, unsaved changes in its worktree stop it and are listed.
 * The session reads "Archiving…" until the app answers, and a second press does nothing.
 */
export async function archiveSession(
  ctx: Context,
  call: { ref: SessionRef; force: boolean },
): Promise<ArchiveOutcome> {
  const key = busyKey("archive", keyOf(call.ref));
  const outcome = await whileBusy(ctx, { key, work: () => archiveRequest(ctx, call) });
  return outcome ?? { status: "failed" };
}
