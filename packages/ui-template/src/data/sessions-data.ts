import type { Client, SessionEvent, SessionId, SessionRow } from "@agentcontrol/sdk";
import { type Context, inBackground } from "./context.ts";
import { appendEvents, mergeFetched, upsertSessions } from "./merge.ts";
import type { DataState } from "./model.ts";

const PAGE = 1000;

/** Every event after `after`, fetched page by page. */
async function fetchEventsAfter(
  client: Client,
  call: { id: SessionId; after: number },
): Promise<SessionEvent[]> {
  const all: SessionEvent[] = [];
  for (let from = call.after; ; ) {
    const page = await client.sessions.events(call.id, { after: from, limit: PAGE });
    all.push(...page);
    const last = page.at(-1);
    if (last === undefined || page.length < PAGE) return all;
    from = last.seq;
  }
}

const lastSeqOf = (state: DataState, id: SessionId): number => state.events[id]?.at(-1)?.seq ?? 0;

function holdEvents(ctx: Context, id: SessionId, fresh: readonly SessionEvent[]): void {
  ctx.store.update((s) => ({
    ...s,
    events: { ...s.events, [id]: appendEvents(s.events[id] ?? [], fresh) },
  }));
}

/** Loads the events after the last one held, and keeps this session's history current from now on. */
export async function loadEvents(ctx: Context, id: SessionId): Promise<void> {
  holdEvents(ctx, id, []);
  const after = lastSeqOf(ctx.store.get(), id);
  holdEvents(ctx, id, await fetchEventsAfter(ctx.client, { id, after }));
}

/** One session's token usage and cost, per finished turn. */
async function loadUsage(ctx: Context, id: SessionId): Promise<void> {
  const rows = await ctx.client.sessions.usage(id);
  ctx.store.update((s) => ({ ...s, usage: { ...s.usage, [id]: rows } }));
}

/** Sessions already opened must be kept current; the row itself carries what the list needs. */
function needsEvents(state: DataState, row: SessionRow): boolean {
  return state.events[row.id] !== undefined && lastSeqOf(state, row.id) < row.lastSeq;
}

/** Fetches the history of every session that has fallen behind its summary. */
function catchUp(ctx: Context): void {
  const state = ctx.store.get();
  for (const row of state.sessions) {
    if (needsEvents(state, row)) inBackground(ctx, loadEvents(ctx, row.id));
  }
}

/** Usage is read again only for a session never read, or one that has new events since. */
function usageIsOutOfDate(before: DataState, row: SessionRow): boolean {
  const known = before.sessions.find((held) => held.id === row.id);
  return before.usage[row.id] === undefined || known?.lastSeq !== row.lastSeq;
}

/** Takes in the app's session list (never dropping a newer row), and catches up what it shows. */
export async function loadSessions(ctx: Context): Promise<void> {
  const fetched = await ctx.client.sessions.list();
  const before = ctx.store.get();
  ctx.store.update((s) => ({ ...s, sessions: mergeFetched(s.sessions, fetched), loaded: true }));
  for (const row of fetched) {
    if (usageIsOutOfDate(before, row)) inBackground(ctx, loadUsage(ctx, row.id));
  }
  catchUp(ctx);
}

/** Live session summaries: merged into the list; usage reloads when a status changed. */
export function applySummaries(ctx: Context, summaries: readonly SessionRow[]): void {
  const before = ctx.store.get().sessions;
  ctx.store.update((s) => ({ ...s, sessions: upsertSessions(s.sessions, summaries) }));
  for (const { id, status } of summaries) {
    if (before.find((row) => row.id === id)?.status !== status) {
      inBackground(ctx, loadUsage(ctx, id));
    }
  }
  catchUp(ctx);
}

/** A live event: appended when it follows the last one held, a refetch when one was missed. */
export function applyEvent(ctx: Context, event: SessionEvent): void {
  const { sessionId, seq } = event;
  const last = lastSeqOf(ctx.store.get(), sessionId);
  if (ctx.store.get().events[sessionId] === undefined || seq <= last) return;
  if (seq === last + 1) holdEvents(ctx, sessionId, [event]);
  else inBackground(ctx, loadEvents(ctx, sessionId));
}
