import type { SessionId, SessionSummary } from "@agentcontrol/protocol";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { chunks, type Db } from "./db.ts";
import { toSessionRow, toStoredSession } from "./rows.ts";
import { sessions } from "./schema.ts";
import type { SessionFilter, StoredSession } from "./types.ts";

const overwriteAll = {
  agent: sql`excluded.agent`,
  status: sql`excluded.status`,
  waitingReason: sql`excluded.waiting_reason`,
  title: sql`excluded.title`,
  kind: sql`excluded.kind`,
  repoPath: sql`excluded.repo_path`,
  branch: sql`excluded.branch`,
  baseBranch: sql`excluded.base_branch`,
  lastSeq: sql`excluded.last_seq`,
  createdAt: sql`excluded.created_at`,
  archivedAt: sql`excluded.archived_at`,
  turnRunning: sql`excluded.turn_running`,
  pendingPermissionsJson: sql`excluded.pending_permissions_json`,
};

export function saveSessionSummaries(db: Db, workspaceId: string, list: SessionSummary[]): void {
  const rows = list.map((s) => toSessionRow(workspaceId, s));
  db.transaction((tx) => {
    for (const part of chunks(rows)) {
      tx.insert(sessions)
        .values(part)
        .onConflictDoUpdate({ target: [sessions.workspaceId, sessions.id], set: overwriteAll })
        .run();
    }
  });
}

function archivedCondition(archived: boolean | undefined) {
  if (archived === undefined) return undefined;
  return archived ? isNotNull(sessions.archivedAt) : isNull(sessions.archivedAt);
}

function workspaceCondition(workspaceId: string | undefined) {
  return workspaceId === undefined ? undefined : eq(sessions.workspaceId, workspaceId);
}

export function listSessions(db: Db, filter?: SessionFilter): StoredSession[] {
  const rows = db
    .select()
    .from(sessions)
    .where(and(archivedCondition(filter?.archived), workspaceCondition(filter?.workspaceId)))
    .orderBy(desc(sessions.createdAt))
    .all();
  return rows.map(toStoredSession);
}

export function getSession(
  db: Db,
  key: { workspaceId: string; sessionId: SessionId },
): StoredSession | undefined {
  const row = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.workspaceId, key.workspaceId), eq(sessions.id, key.sessionId)))
    .get();
  return row && toStoredSession(row);
}
