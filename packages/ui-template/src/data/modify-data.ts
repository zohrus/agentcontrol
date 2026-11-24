import type { Client, ModifyState, SessionId } from "@agentcontrol/sdk";
import { attempt, type Context, inBackground } from "./context.ts";
import { busyKey, whileBusy } from "./pending.ts";
import { loadEvents } from "./sessions-data.ts";
import { keyOf, LOCAL_WORKSPACE, type SessionRef } from "./session-ref.ts";

/** The Modify agent runs on this Mac, so its session is a local one. */
export const modifySession = (id: SessionId): SessionRef => ({ workspaceId: LOCAL_WORKSPACE, id });

type Call = (modify: Client["modify"]) => Promise<ModifyState>;

async function loadHistory(ctx: Context): Promise<void> {
  const versions = await ctx.client.modify.history();
  ctx.store.update((s) => ({ ...s, versions }));
}

/** The Modify session's events are the chat: load them once, then the live stream keeps them current. */
function followChat(ctx: Context, state: ModifyState): void {
  const id = state.sessionId;
  if (id === undefined || ctx.store.get().events[keyOf(modifySession(id))] !== undefined) return;
  inBackground(ctx, loadEvents(ctx, modifySession(id)));
}

/** Takes in a new Modify state; the history is read again when a change was settled. */
export function applyModify(ctx: Context, state: ModifyState): void {
  const before = ctx.store.get().modify;
  ctx.store.update((s) => ({ ...s, modify: state }));
  followChat(ctx, state);
  const settled = before !== undefined && before.status !== "idle" && state.status === "idle";
  if (settled) inBackground(ctx, loadHistory(ctx));
}

/** Reads the state and history from the app: on first connection and after every reconnect. */
export async function loadModify(ctx: Context): Promise<void> {
  const heldBefore = ctx.store.get().modify;
  const state = await ctx.client.modify.state();
  // A live message that arrived while this answer was on its way is newer than it.
  if (ctx.store.get().modify === heldBefore) ctx.store.update((s) => ({ ...s, modify: state }));
  const { sessionId } = ctx.store.get().modify ?? state;
  const chat = sessionId === undefined ? [] : loadEvents(ctx, modifySession(sessionId));
  await Promise.all([loadHistory(ctx), chat]);
}

/** Runs something the user asked of the Modify agent and shows the state it answers with. */
async function act(ctx: Context, call: Call): Promise<void> {
  const heldBefore = ctx.store.get().modify;
  const state = await attempt(ctx, () => call(ctx.client.modify));
  if (state === undefined) return;
  // A live message that arrived before this answer is newer than it.
  if (ctx.store.get().modify === heldBefore) applyModify(ctx, state);
  inBackground(ctx, loadHistory(ctx));
}

/** What the user asked of the Modify agent that is still being answered (see `useModify`). */
export type ModifyAction = "request" | "keep" | "undo" | "discard" | "restore" | "update";

/** Runs the action, which reads as in progress until it is answered; asking twice does nothing. */
function pressed(ctx: Context, call: { name: ModifyAction; choice?: string; call: Call }) {
  const key = busyKey("modify", call.name);
  return whileBusy(ctx, {
    key,
    choice: call.choice ?? "",
    work: () => act(ctx, call.call),
  });
}

/** One function per thing the user can do to the UI itself. */
export function modifyActions(ctx: Context) {
  return {
    request: (text: string) =>
      pressed(ctx, { name: "request", choice: text, call: (m) => m.request(text) }),
    keep: () => pressed(ctx, { name: "keep", call: (m) => m.keep() }),
    undo: () => pressed(ctx, { name: "undo", call: (m) => m.undo() }),
    discard: () => pressed(ctx, { name: "discard", call: (m) => m.discard() }),
    restore: (commit: string) => pressed(ctx, { name: "restore", call: (m) => m.restore(commit) }),
    applyUpdate: () => pressed(ctx, { name: "update", call: (m) => m.applyUpdate() }),
  };
}
