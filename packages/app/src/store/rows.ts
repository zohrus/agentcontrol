import type { SessionEvent, SessionSummary } from "@agentcontrol/protocol";
import type { events, sessions } from "./schema.ts";
import type { StoredSession } from "./types.ts";

type SessionRow = typeof sessions.$inferSelect;
type EventRow = typeof events.$inferSelect;

export function toStoredSession(row: SessionRow): StoredSession {
  const { waitingReason, archivedAt, pendingPermissionsJson, ...rest } = row;
  return {
    ...rest,
    pendingPermissions: JSON.parse(pendingPermissionsJson) as StoredSession["pendingPermissions"],
    ...(waitingReason === null ? {} : { waitingReason }),
    ...(archivedAt === null ? {} : { archivedAt }),
  } as StoredSession;
}

export function toSessionRow(workspaceId: string, s: SessionSummary): SessionRow {
  const { pendingPermissions, ...rest } = s;
  return {
    ...rest,
    workspaceId,
    waitingReason: s.waitingReason ?? null,
    archivedAt: s.archivedAt ?? null,
    pendingPermissionsJson: JSON.stringify(pendingPermissions),
  };
}

export function toEventRow(workspaceId: string, e: SessionEvent): EventRow {
  return {
    workspaceId,
    sessionId: e.sessionId,
    seq: e.seq,
    ts: e.ts,
    kind: e.kind,
    payloadJson: JSON.stringify(e.payload),
  };
}

export function toSessionEvent(row: EventRow): SessionEvent {
  const { sessionId, seq, ts, kind, payloadJson } = row;
  return { sessionId, seq, ts, kind, payload: JSON.parse(payloadJson) as unknown } as SessionEvent;
}
