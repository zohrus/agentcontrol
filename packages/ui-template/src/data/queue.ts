import type { SessionRow } from "@agentcontrol/sdk";
import { isTurnRunning, takesPrompt } from "../session-view/index.ts";
import { type Context, inBackground } from "./context.ts";
import type { DataState, QueuedMessage } from "./model.ts";
import { cancelTurn } from "./commands.ts";
import { sendMessage } from "./outgoing.ts";
import { without } from "./pending.ts";
import { keyOf, refOf, type SessionRef } from "./session-ref.ts";

const queueOf = (state: DataState, key: string): readonly QueuedMessage[] =>
  state.queued[key] ?? [];

/** The session's queue; an empty one is dropped, and with it the hold put on it by Cancel. */
function holdQueue(state: DataState, call: { key: string; messages: readonly QueuedMessage[] }) {
  const { key, messages } = call;
  if (messages.length > 0) return { ...state, queued: { ...state.queued, [key]: messages } };
  const [queued, queuePaused] = [without(state.queued, key), without(state.queuePaused, key)];
  return { ...state, queued, queuePaused };
}

/** Adds the message at the end of the session's queue; it is sent when the agent is free. */
function queueMessage(ctx: Context, call: { ref: SessionRef; text: string }): void {
  const key = keyOf(call.ref);
  const message = { id: crypto.randomUUID(), text: call.text };
  ctx.store.update((s) => holdQueue(s, { key, messages: [...queueOf(s, key), message] }));
}

/** Drops a message from the queue (Remove, or taken out to be edited). */
function removeQueued(ctx: Context, call: { ref: SessionRef; id: string }): void {
  const key = keyOf(call.ref);
  ctx.store.update((s) =>
    holdQueue(s, { key, messages: queueOf(s, key).filter((m) => m.id !== call.id) }),
  );
}

/** After Cancel the queue waits for the user: nothing is sent by itself until `resumeQueue`. */
function pauseQueue(ctx: Context, ref: SessionRef): void {
  const key = keyOf(ref);
  if (queueOf(ctx.store.get(), key).length === 0) return;
  ctx.store.update((s) => ({ ...s, queuePaused: { ...s.queuePaused, [key]: true } }));
}

/** Lets a held queue go on: its first message is sent as soon as the agent is free. */
function resumeQueue(ctx: Context, ref: SessionRef): void {
  const key = keyOf(ref);
  ctx.store.update((s) =>
    s.queuePaused[key] === undefined ? s : { ...s, queuePaused: without(s.queuePaused, key) },
  );
}

/** True while the agent works on a turn, or a message just sent is not in the history yet (or failed). */
function isBusy(state: DataState, call: { row: SessionRow; key: string }): boolean {
  const { row, key } = call;
  const events = state.events[key];
  // A message that failed to send also holds the queue: the next one must not overtake it.
  const sending = (state.pending.messages[key] ?? []).length > 0;
  return row.turnRunning || sending || (events !== undefined && isTurnRunning(events));
}

function canSendNext(state: DataState, row: SessionRow): boolean {
  const key = keyOf(refOf(row));
  return takesPrompt(row) && state.queuePaused[key] === undefined && !isBusy(state, { row, key });
}

/** Sends the first message of the session's queue when the agent is free for it. */
function deliverFor(ctx: Context, key: string): void {
  const state = ctx.store.get();
  const first = queueOf(state, key)[0];
  const row = state.sessions.find((held) => keyOf(refOf(held)) === key);
  if (first === undefined || row === undefined || !canSendNext(state, row)) return;
  const ref = refOf(row);
  // The message is outgoing first, so the agent counts as busy before the queue changes.
  inBackground(ctx, sendMessage(ctx, { ref, text: first.text }));
  removeQueued(ctx, { ref, id: first.id });
}

/** Sends the next queued message of every session whose agent is free; one per session at a time. */
function deliverQueued(ctx: Context): void {
  for (const key of Object.keys(ctx.store.get().queued)) deliverFor(ctx, key);
}

/** Queued messages go out whenever a change to the state leaves their agent free; returns the stop. */
export function startDelivering(ctx: Context): () => void {
  return ctx.store.subscribe(() => {
    deliverQueued(ctx);
  });
}

/** One function per thing the user can do with the message box and its queue. */
export function queueActions(ctx: Context) {
  return {
    /** The message is in the conversation at once; the app is asked in the background. */
    sendPrompt: (ref: SessionRef, text: string) => {
      const sent = sendMessage(ctx, { ref, text });
      // Sending is what the user did instead of waiting: a held queue goes on after this message.
      resumeQueue(ctx, ref);
      return sent;
    },
    /** The message waits in the queue above the message box until the agent is free. */
    queuePrompt: (ref: SessionRef, text: string) => {
      queueMessage(ctx, { ref, text });
      // Writing a message is a sign to go on: a queue held back by Cancel is released.
      resumeQueue(ctx, ref);
    },
    removeQueuedPrompt: (ref: SessionRef, id: string) => {
      removeQueued(ctx, { ref, id });
    },
    /** Lets a queue held back by Cancel go on: its first message is sent now. */
    resumeQueuedPrompts: (ref: SessionRef) => {
      resumeQueue(ctx, ref);
    },
    /** Stops the turn; what is queued then waits for the user instead of going out by itself. */
    cancel: (ref: SessionRef) => {
      pauseQueue(ctx, ref);
      return cancelTurn(ctx, ref);
    },
  };
}
