import type { Client, LiveSessionEvent, SessionEvent, SessionRow } from "@agentcontrol/sdk";
import { type Context, inBackground } from "./context.ts";
import { browserFrames, createEventQueue, type EventQueue } from "./event-queue.ts";
import { appendEvents, mergeFetched, upsertSessions } from "./merge.ts";
import type { DataState } from "./model.ts";
import { isCreating, setCreating, settleOutgoing, withoutLeavingSessions } from "./pending.ts";
import { isRow, keyOf, refOf, type SessionRef } from "./session-ref.ts";

const PAGE = 1000;

/** Every event after `after`, fetched page by page. */
async function fetchEventsAfter(
  client: Client,
  call: { ref: SessionRef; after: number },
): Promise<SessionEvent[]> {
  const all: SessionEvent[] = [];
  for (let from = call.after; ; ) {
    const page = await client.sessions.events(call.ref.id, { after: from, limit: PAGE });
    all.push(...page);
    const last = page.at(-1);
    if (last === undefined || page.length < PAGE) return all;
    from = last.seq;
  }
}

const lastSeqOf = (state: DataState, ref: SessionRef): number =>
  state.events[keyOf(ref)]?.at(-1)?.seq ?? 0;

/** The state with the events after the last one held added to the session's history. */
function withEvents(s: DataState, call: { ref: SessionRef; fresh: readonly SessionEvent[] }) {
  const key = keyOf(call.ref);
  const have = s.events[key] ?? [];
  const events = appendEvents(have, call.fresh);
  // A message the user sent is in the history now: it stops being shown as outgoing.
  return settleOutgoing(
    { ...s, events: { ...s.events, [key]: events } },
    { key, fresh: events.slice(have.length) },
  );
}

function holdEvents(ctx: Context, ref: SessionRef, fresh: readonly SessionEvent[]): void {
  ctx.store.update((s) => withEvents(s, { ref, fresh }));
}

const queues = new WeakMap<Context, EventQueue>();

/** The newest event the UI knows of for the session: held in its history or waiting for the next frame. */
export function newestSeq(ctx: Context, ref: SessionRef): number {
  return Math.max(queueOf(ctx).lastSeq(ref) ?? 0, lastSeqOf(ctx.store.get(), ref));
}

/** The live events of a context wait here for the next frame, then go into the store as one update. */
function queueOf(ctx: Context): EventQueue {
  const known = queues.get(ctx);
  if (known !== undefined) return known;
  const queue = createEventQueue({
    frames: browserFrames,
    take: (batches) => {
      ctx.store.update((s) =>
        batches.reduce((next, { ref, events }) => withEvents(next, { ref, fresh: events }), s),
      );
    },
  });
  queues.set(ctx, queue);
  return queue;
}

/** Loads the events after the last one held, and keeps this session's history current from now on. */
export async function loadEvents(ctx: Context, ref: SessionRef): Promise<void> {
  if (isCreating(ctx, keyOf(ref))) return;
  holdEvents(ctx, ref, []);
  const after = lastSeqOf(ctx.store.get(), ref);
  holdEvents(ctx, ref, await fetchEventsAfter(ctx.client, { ref, after }));
}

/** One session's token usage and cost, per finished turn. */
async function loadUsage(ctx: Context, ref: SessionRef): Promise<void> {
  const rows = await ctx.client.sessions.usage(ref.id);
  ctx.store.update((s) => ({ ...s, usage: { ...s.usage, [keyOf(ref)]: rows } }));
}

/** Sessions already opened must be kept current; the row itself carries what the list needs. */
function needsEvents(ctx: Context, row: SessionRow): boolean {
  const ref = refOf(row);
  const state = ctx.store.get();
  const held = Math.max(queueOf(ctx).lastSeq(ref) ?? 0, lastSeqOf(state, ref));
  return state.events[keyOf(ref)] !== undefined && held < row.lastSeq;
}

/** Fetches the history of every session that has fallen behind its summary. */
function catchUp(ctx: Context): void {
  const state = ctx.store.get();
  for (const row of state.sessions) {
    if (needsEvents(ctx, row)) inBackground(ctx, loadEvents(ctx, refOf(row)));
  }
}

/** Usage is read again only for a session never read, or one that has new events since. */
function usageIsOutOfDate(before: DataState, row: SessionRow): boolean {
  const known = before.sessions.find((held) => isRow(held, refOf(row)));
  return before.usage[keyOf(refOf(row))] === undefined || known?.lastSeq !== row.lastSeq;
}

/** Takes in the app's session list (never dropping a newer row), and catches up what it shows. */
export async function loadSessions(ctx: Context): Promise<void> {
  const fetched = await ctx.client.sessions.list();
  const before = ctx.store.get();
  ctx.store.update((s) =>
    withoutLeavingSessions({ ...s, sessions: mergeFetched(s.sessions, fetched), loaded: true }),
  );
  adoptCreated(ctx, fetched);
  for (const row of fetched) {
    if (usageIsOutOfDate(before, row)) inBackground(ctx, loadUsage(ctx, refOf(row)));
  }
  catchUp(ctx);
}

/** A session this UI created that the app now lists has been taken: its history can be loaded. */
function adoptCreated(ctx: Context, summaries: readonly SessionRow[]): void {
  for (const row of summaries) {
    const ref = refOf(row);
    if (!isCreating(ctx, keyOf(ref))) continue;
    setCreating(ctx, { key: keyOf(ref), creating: false });
    inBackground(ctx, loadEvents(ctx, ref));
  }
}

/** Live session summaries: merged into the list; usage reloads when a status changed. */
export function applySummaries(ctx: Context, summaries: readonly SessionRow[]): void {
  const before = ctx.store.get().sessions;
  adoptCreated(ctx, summaries);
  ctx.store.update((s) =>
    withoutLeavingSessions({ ...s, sessions: upsertSessions(s.sessions, summaries) }),
  );
  for (const row of summaries) {
    const known = before.find((held) => isRow(held, refOf(row)));
    if (known?.status !== row.status) inBackground(ctx, loadUsage(ctx, refOf(row)));
  }
  catchUp(ctx);
}

/**
 * A live event: held until the next frame when it follows the last one held, so a burst is one
 * update of the state and one render; a refetch when one was missed.
 */
export function applyEvent(ctx: Context, event: LiveSessionEvent): void {
  const ref = { workspaceId: event.workspaceId, id: event.sessionId };
  const queue = queueOf(ctx);
  const { seq } = event;
  const last = newestSeq(ctx, ref);
  if (ctx.store.get().events[keyOf(ref)] === undefined || seq <= last) return;
  if (seq === last + 1) {
    queue.add(ref, event);
    return;
  }
  queue.flush();
  inBackground(ctx, loadEvents(ctx, ref));
}
