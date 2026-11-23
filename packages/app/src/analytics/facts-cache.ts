import type { Store, StoredSession } from "../store/index.ts";
import { factsOfEvents } from "./facts.ts";
import { type Filters, hasRange, inRange } from "./filters.ts";
import type { SessionFacts } from "./types.ts";

/** What a session's events say inside the range: its facts, and how many events were in it. */
export type Seen = { facts: SessionFacts; eventCount: number };

/** What the facts were worked out from: the saved events and the range. */
interface Entry {
  stamp: string;
  seen: Seen;
}

const LIVE = new Set(["starting", "running", "waiting"]);

export interface FactsCache {
  /** The facts of one session; read from its saved events only when they changed since last time. */
  seenIn(call: {
    store: Store;
    session: StoredSession;
    filters: Filters;
    /** The highest seq the store holds for the session. */
    lastSeq: number;
    now: number;
  }): Seen;
}

function workOut(call: {
  store: Store;
  session: StoredSession;
  filters: Filters;
  now: number;
}): Seen {
  const { store, session, filters, now } = call;
  const all = store.eventsAfter({
    workspaceId: session.workspaceId,
    sessionId: session.id,
    afterSeq: 0,
    limit: Number.MAX_SAFE_INTEGER,
  });
  const events = hasRange(filters) ? all.filter((event) => inRange(event.ts, filters)) : all;
  // A live session's open turn runs to now, but never past the end of the range asked for.
  const liveUntil = LIVE.has(session.status) ? Math.min(now, filters.toMs ?? now) : undefined;
  return { facts: factsOfEvents(events, liveUntil), eventCount: events.length };
}

/**
 * Remembers each session's facts, keyed by the session's last saved seq (and the range, and the
 * store's revision, which changes when saved events are re-translated). Reading every event of
 * every session on each request is what this saves. A session that is still live is never
 * remembered: how long it has been waiting depends on the clock.
 */
export function createFactsCache(): FactsCache {
  const entries = new Map<string, Entry>();
  return {
    seenIn: (call) => {
      const { store, session, filters, lastSeq } = call;
      if (LIVE.has(session.status)) return workOut(call);
      const key = `${session.workspaceId}\u0000${session.id}`;
      const range = `${String(filters.fromMs)}|${String(filters.toMs)}`;
      const stamp = `${String(store.revision())}:${String(lastSeq)}:${range}`;
      const known = entries.get(key);
      if (known?.stamp === stamp) return known.seen;
      const seen = workOut(call);
      entries.set(key, { stamp, seen });
      return seen;
    },
  };
}
