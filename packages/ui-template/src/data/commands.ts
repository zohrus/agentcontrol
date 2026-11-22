import type { SessionId, StartSession } from "@agentcontrol/sdk";
import { attempt, type Context } from "./context.ts";
import { uncommittedFilesOf } from "./errors.ts";
import { loadSessions } from "./sessions-data.ts";

/** How an archive request ended: done, held back by unsaved changes, or failed (already reported). */
export type ArchiveOutcome =
  | { status: "archived" }
  | { status: "blocked"; files: readonly string[] }
  | { status: "failed" };

/** Reloads the list after an action; a failure here must not turn a done action into a failed one. */
async function refreshList(ctx: Context): Promise<void> {
  await loadSessions(ctx).catch(() => undefined);
}

/** Starts a session and resolves with its id, so the UI can open it. */
export function startSession(ctx: Context, request: StartSession): Promise<SessionId | undefined> {
  return attempt(ctx, async () => {
    const id = await ctx.client.sessions.start(request);
    await refreshList(ctx);
    return id;
  });
}

export function sendPrompt(ctx: Context, call: { id: SessionId; text: string }) {
  return attempt(ctx, () => ctx.client.sessions.sendPrompt(call.id, call.text));
}

export function cancelTurn(ctx: Context, id: SessionId) {
  return attempt(ctx, () => ctx.client.sessions.cancel(id));
}

export function answerPermission(
  ctx: Context,
  call: { id: SessionId; requestId: string; optionId: string },
) {
  const { id, requestId, optionId } = call;
  return attempt(ctx, () => ctx.client.sessions.answerPermission(id, requestId, optionId));
}

/** Archives a session; without `force`, unsaved changes in its worktree stop it and are listed. */
export async function archiveSession(
  ctx: Context,
  call: { id: SessionId; force: boolean },
): Promise<ArchiveOutcome> {
  try {
    await ctx.client.sessions.archive(call.id, call.force ? { force: true } : {});
    await refreshList(ctx);
    return { status: "archived" };
  } catch (error) {
    const files = uncommittedFilesOf(error);
    if (files !== undefined) return { status: "blocked", files };
    ctx.report(error);
    return { status: "failed" };
  }
}
