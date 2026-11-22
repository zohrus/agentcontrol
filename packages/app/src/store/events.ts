import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import { and, asc, eq, gt, max } from "drizzle-orm";
import { chunks, type Db } from "./db.ts";
import { toEventRow, toSessionEvent } from "./rows.ts";
import { events } from "./schema.ts";

export function saveEvents(db: Db, workspaceId: string, list: SessionEvent[]): void {
  const rows = list.map((e) => toEventRow(workspaceId, e));
  db.transaction((tx) => {
    for (const part of chunks(rows)) tx.insert(events).values(part).onConflictDoNothing().run();
  });
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
  query: { sessionId: SessionId; afterSeq: number; limit?: number },
): SessionEvent[] {
  const { sessionId, afterSeq, limit = 1000 } = query;
  return db
    .select()
    .from(events)
    .where(and(eq(events.sessionId, sessionId), gt(events.seq, afterSeq)))
    .orderBy(asc(events.seq))
    .limit(limit)
    .all()
    .map(toSessionEvent);
}
