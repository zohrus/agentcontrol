import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import { and, asc, eq, gt, lt, max, sql } from "drizzle-orm";
import { chunks, type Db } from "./db.ts";
import { toEventRow, toSessionEvent } from "./rows.ts";
import { events, sessionNormalisation } from "./schema.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Notes the version the session's events were made with, unless an older one is already noted. */
function noteVersion(tx: Tx, call: { workspaceId: string; list: SessionEvent[]; version: number }) {
  const { workspaceId, list, version } = call;
  const sessionIds = new Set(list.map((event) => event.sessionId));
  for (const sessionId of sessionIds) {
    tx.insert(sessionNormalisation)
      .values({ workspaceId, sessionId, version })
      .onConflictDoNothing()
      .run();
  }
}

/** Saves events the relay sent, made with this version of its event translation. */
export function saveEvents(
  db: Db,
  call: { workspaceId: string; list: SessionEvent[]; normaliserVersion: number },
): void {
  const { workspaceId, list, normaliserVersion } = call;
  const rows = list.map((e) => toEventRow(workspaceId, e));
  db.transaction((tx) => {
    for (const part of chunks(rows)) tx.insert(events).values(part).onConflictDoNothing().run();
    noteVersion(tx, { workspaceId, list, version: normaliserVersion });
  });
}

/** Replaces the saved events of one session with these, in one transaction. */
export function replaceSessionEvents(
  db: Db,
  call: { workspaceId: string; list: SessionEvent[]; sessionId: SessionId; version: number },
): void {
  const { workspaceId, list, sessionId, version } = call;
  const rows = list.map((e) => toEventRow(workspaceId, e));
  const overwrite = {
    ts: sql`excluded.ts`,
    kind: sql`excluded.kind`,
    payloadJson: sql`excluded.payload_json`,
  };
  db.transaction((tx) => {
    for (const part of chunks(rows)) {
      const target = [events.workspaceId, events.sessionId, events.seq];
      tx.insert(events).values(part).onConflictDoUpdate({ target, set: overwrite }).run();
    }
    tx.insert(sessionNormalisation)
      .values({ workspaceId, sessionId, version })
      .onConflictDoUpdate({
        target: [sessionNormalisation.workspaceId, sessionNormalisation.sessionId],
        set: { version },
      })
      .run();
  });
}

/** Sessions whose saved events were made with an older version than this. */
export function sessionsNormalisedBefore(
  db: Db,
  call: { workspaceId: string; version: number },
): SessionId[] {
  return db
    .select({ sessionId: sessionNormalisation.sessionId })
    .from(sessionNormalisation)
    .where(
      and(
        eq(sessionNormalisation.workspaceId, call.workspaceId),
        lt(sessionNormalisation.version, call.version),
      ),
    )
    .all()
    .map((row) => row.sessionId as SessionId);
}

export function lastSeqs(db: Db, workspaceId: string): Record<string, number> {
  const rows = db
    .select({ id: events.sessionId, seq: max(events.seq) })
    .from(events)
    .where(eq(events.workspaceId, workspaceId))
    .groupBy(events.sessionId)
    .all();
  return Object.fromEntries(rows.map((r) => [r.id, r.seq ?? 0]));
}

export function eventsAfter(
  db: Db,
  query: { workspaceId: string; sessionId: SessionId; afterSeq: number; limit?: number },
): SessionEvent[] {
  const { workspaceId, sessionId, afterSeq, limit = 1000 } = query;
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.workspaceId, workspaceId),
        eq(events.sessionId, sessionId),
        gt(events.seq, afterSeq),
      ),
    )
    .orderBy(asc(events.seq))
    .limit(limit)
    .all()
    .map(toSessionEvent);
}
