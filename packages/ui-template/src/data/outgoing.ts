import type { Context } from "./context.ts";
import { describeError } from "./errors.ts";
import type { OutgoingMessage } from "./model.ts";
import { changeOutgoing } from "./pending.ts";
import { isRow, keyOf, type SessionRef } from "./session-ref.ts";
import { newestSeq } from "./sessions-data.ts";

type Target = { ref: SessionRef; localId: string };

const change = (ctx: Context, target: Target, update: (m: OutgoingMessage) => OutgoingMessage) => {
  const apply = (held: readonly OutgoingMessage[]) =>
    held.some((m) => m.localId === target.localId)
      ? held.map((m) => (m.localId === target.localId ? update(m) : m))
      : held;
  changeOutgoing(ctx, { key: keyOf(target.ref), change: apply });
};

/** Hands the message to the app; it becomes "sent", or "failed" with the reason. */
async function deliver(ctx: Context, call: Target & { text: string }): Promise<void> {
  try {
    await ctx.client.sessions.sendPrompt(call.ref.id, call.text);
    change(ctx, call, (m) => ({ ...m, state: "sent" }));
  } catch (error) {
    const failed = { state: "failed" as const, error: describeError(error) };
    change(ctx, call, (m) => ({ ...m, ...failed }));
  }
}

/** The newest event of the session that the UI knows of, from its history or its list row. */
function seenSeq(ctx: Context, ref: SessionRef): number {
  const state = ctx.store.get();
  const listed = state.sessions.filter((row) => isRow(row, ref)).map((row) => row.lastSeq);
  return Math.max(newestSeq(ctx, ref), ...listed);
}

/** Shows the message in the conversation at once, then sends it; the history's own copy replaces it. */
export function sendMessage(ctx: Context, call: { ref: SessionRef; text: string }): Promise<void> {
  const { ref, text } = call;
  const afterSeq = seenSeq(ctx, ref);
  const message: OutgoingMessage = {
    localId: crypto.randomUUID(),
    text,
    afterSeq,
    state: "sending",
    error: undefined,
  };
  changeOutgoing(ctx, { key: keyOf(ref), change: (held) => [...held, message] });
  return deliver(ctx, { ref, localId: message.localId, text });
}

/** Sends a message that failed once more. */
export function retryMessage(ctx: Context, target: Target): Promise<void> {
  const held = ctx.store.get().pending.messages[keyOf(target.ref)] ?? [];
  const message = held.find((m) => m.localId === target.localId);
  if (message?.state !== "failed") return Promise.resolve();
  change(ctx, target, (m) => ({ ...m, state: "sending", error: undefined }));
  return deliver(ctx, { ...target, text: message.text });
}

/** Gives up on a message that failed: it leaves the conversation. */
export function dismissMessage(ctx: Context, target: Target): void {
  changeOutgoing(ctx, {
    key: keyOf(target.ref),
    change: (held) => held.filter((m) => m.localId !== target.localId),
  });
}
