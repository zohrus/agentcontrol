import type { SessionEvent, SessionSummary } from "@agentcontrol/protocol";
import type { events, sessions, workspaces } from "./schema.ts";
import type { StoredSession, Workspace } from "./types.ts";

type WorkspaceRow = typeof workspaces.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;
type EventRow = typeof events.$inferSelect;

export function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    ...(row.sshHost === null ? {} : { sshHost: row.sshHost }),
    ...(row.lastSeenAt === null ? {} : { lastSeenAt: row.lastSeenAt }),
  };
}

export function toStoredSession(row: SessionRow): StoredSession {
  const { waitingReason, archivedAt, ...rest } = row;
  return {
    ...rest,
    ...(waitingReason === null ? {} : { waitingReason }),
    ...(archivedAt === null ? {} : { archivedAt }),
  } as StoredSession;
}

export function toSessionRow(workspaceId: string, s: SessionSummary): SessionRow {
  return {
    ...s,
    workspaceId,
    waitingReason: s.waitingReason ?? null,
    archivedAt: s.archivedAt ?? null,
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
