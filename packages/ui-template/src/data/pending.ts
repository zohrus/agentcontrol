import type { SessionEvent } from "@agentcontrol/sdk";
import type { Context } from "./context.ts";
import type { DataState, OutgoingMessage, Pending } from "./model.ts";
import { keyOf, refOf, type SessionRef } from "./session-ref.ts";

/** The things a user can start that take a while: each one is shown as "in progress" while it runs. */
type BusyKind = "cancel" | "archive" | "resume" | "answer" | "modify";

/** The name an action in flight is held under: its kind and what it acts on (a session or request). */
export const busyKey = (kind: BusyKind, target: string): string => `${kind}:${target}`;

const withPending = (state: DataState, change: (pending: Pending) => Pending): DataState => ({
  ...state,
  pending: change(state.pending),
});

/** The record without one key. */
function without<V>(record: Readonly<Record<string, V>>, key: string): Record<string, V> {
  return Object.fromEntries(Object.entries(record).filter(([held]) => held !== key));
}

/** Holds an action in flight (with what it chose), or, with no choice, drops it. */
function setBusy(ctx: Context, call: { key: string; choice: string | undefined }): void {
  const { key, choice } = call;
  const held = (busy: Pending["busy"]) =>
    choice === undefined ? without(busy, key) : { ...busy, [key]: choice };
  ctx.store.update((s) => withPending(s, (p) => ({ ...p, busy: held(p.busy) })));
}

/**
 * Marks the action as in flight, runs it, and marks it done, whatever happened. While it runs a
 * second press of the same action does nothing (no double submit); `choice` says what was chosen.
 */
export async function whileBusy<T>(
  ctx: Context,
  call: { key: string; choice?: string; work: () => Promise<T> },
): Promise<T | undefined> {
  const { key } = call;
  if (ctx.store.get().pending.busy[key] !== undefined) return undefined;
  setBusy(ctx, { key, choice: call.choice ?? "" });
  try {
    return await call.work();
  } finally {
    setBusy(ctx, { key, choice: undefined });
  }
}

/** Replaces one session's outgoing messages; none left removes the entry. */
function holdMessages(
  state: DataState,
  call: { key: string; messages: readonly OutgoingMessage[] },
): DataState {
  const { key, messages } = call;
  const rest = without(state.pending.messages, key);
  return withPending(state, (p) => ({
    ...p,
    messages: messages.length === 0 ? rest : { ...rest, [key]: messages },
  }));
}

/** Changes the session's outgoing messages. */
export function changeOutgoing(
  ctx: Context,
  call: { key: string; change: (held: readonly OutgoingMessage[]) => readonly OutgoingMessage[] },
): void {
  ctx.store.update((s) => {
    const held = s.pending.messages[call.key] ?? [];
    const messages = call.change(held);
    return messages === held ? s : holdMessages(s, { key: call.key, messages });
  });
}

/** The first outgoing message with this text goes for each new `prompt-sent` event: the history has it now. */
function withoutShown(
  held: readonly OutgoingMessage[],
  fresh: readonly SessionEvent[],
): readonly OutgoingMessage[] {
  let left = held;
  for (const event of fresh) {
    if (event.kind !== "prompt-sent") continue;
    const shows = (m: OutgoingMessage) =>
      m.state !== "failed" && m.text === event.payload.text && event.seq > m.afterSeq;
    const index = left.findIndex(shows);
    if (index >= 0) left = left.filter((_, i) => i !== index);
  }
  return left;
}

/** The state once the session's history holds `fresh` events: messages it now shows stop being outgoing. */
export function settleOutgoing(
  state: DataState,
  call: { key: string; fresh: readonly SessionEvent[] },
): DataState {
  const held = state.pending.messages[call.key];
  if (held === undefined) return state;
  const messages = withoutShown(held, call.fresh);
  return messages === held ? state : holdMessages(state, { key: call.key, messages });
}

/** Marks a session as created by this UI and not yet confirmed (or not, any more). */
export function setCreating(ctx: Context, call: { key: string; creating: boolean }): void {
  const { key, creating } = call;
  const held = (map: Pending["creating"]) =>
    creating ? { ...map, [key]: true as const } : without(map, key);
  ctx.store.update((s) => withPending(s, (p) => ({ ...p, creating: held(p.creating) })));
}

/** The state without the rows of the sessions that are leaving. */
export function withoutLeavingSessions(state: DataState): DataState {
  const { leaving } = state.pending;
  const sessions = state.sessions.filter((row) => leaving[keyOf(refOf(row))] === undefined);
  return sessions.length === state.sessions.length ? state : { ...state, sessions };
}

/** A session being archived leaves every list at once, and stays out of them until `leaving` is false again. */
export function setLeaving(ctx: Context, call: { ref: SessionRef; leaving: boolean }): void {
  const key = keyOf(call.ref);
  const held = (map: Pending["leaving"]) =>
    call.leaving ? { ...map, [key]: true as const } : without(map, key);
  ctx.store.update((s) =>
    withoutLeavingSessions(withPending(s, (p) => ({ ...p, leaving: held(p.leaving) }))),
  );
}

/** True while the app has not confirmed the session this UI created: it has no history to load yet. */
export function isCreating(ctx: Context, key: string): boolean {
  return ctx.store.get().pending.creating[key] === true;
}
