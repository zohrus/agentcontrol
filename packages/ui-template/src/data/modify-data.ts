import type { Client, ModifyState } from "@agentcontrol/sdk";
import { attempt, type Context, inBackground } from "./context.ts";
import { loadEvents } from "./sessions-data.ts";

type Call = (modify: Client["modify"]) => Promise<ModifyState>;

async function loadHistory(ctx: Context): Promise<void> {
  const versions = await ctx.client.modify.history();
  ctx.store.update((s) => ({ ...s, versions }));
}

/** The Modify session's events are the chat: load them once, then the live stream keeps them current. */
function followChat(ctx: Context, state: ModifyState): void {
  const id = state.sessionId;
  if (id !== undefined && ctx.store.get().events[id] === undefined) {
    inBackground(ctx, loadEvents(ctx, id));
  }
}

/** Takes in a new Modify state; the history is read again when a change was settled. */
export function applyModify(ctx: Context, state: ModifyState): void {
  const before = ctx.store.get().modify;
  ctx.store.update((s) => ({ ...s, modify: state }));
  followChat(ctx, state);
  if (state.status === "idle" && before?.status !== "idle") inBackground(ctx, loadHistory(ctx));
}

/** Reads the state and history from the app: on first connection and after every reconnect. */
export async function loadModify(ctx: Context): Promise<void> {
  const state = await ctx.client.modify.state();
  ctx.store.update((s) => ({ ...s, modify: state }));
  const { sessionId } = state;
  await Promise.all([loadHistory(ctx), sessionId === undefined ? [] : loadEvents(ctx, sessionId)]);
}

/** Runs something the user asked of the Modify agent and shows the state it answers with. */
async function act(ctx: Context, call: Call): Promise<void> {
  const state = await attempt(ctx, () => call(ctx.client.modify));
  if (state === undefined) return;
  applyModify(ctx, state);
  inBackground(ctx, loadHistory(ctx));
}

/** One function per thing the user can do to the UI itself. */
export function modifyActions(ctx: Context) {
  return {
    request: (text: string) => act(ctx, (m) => m.request(text)),
    keep: () => act(ctx, (m) => m.keep()),
    undo: () => act(ctx, (m) => m.undo()),
    discard: () => act(ctx, (m) => m.discard()),
    restore: (commit: string) => act(ctx, (m) => m.restore(commit)),
    applyUpdate: () => act(ctx, (m) => m.applyUpdate()),
  };
}
