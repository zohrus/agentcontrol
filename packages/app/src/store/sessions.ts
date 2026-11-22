import type { SessionId, SessionSummary } from "@agentcontrol/protocol";
import { desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { chunks, type Db } from "./db.ts";
import { toSessionRow, toStoredSession } from "./rows.ts";
import { sessions } from "./schema.ts";
import type { StoredSession } from "./types.ts";

const overwriteAll = {
  workspaceId: sql`excluded.workspace_id`,
  agent: sql`excluded.agent`,
  status: sql`excluded.status`,
  waitingReason: sql`excluded.waiting_reason`,
  title: sql`excluded.title`,
  repoPath: sql`excluded.repo_path`,
  branch: sql`excluded.branch`,
  baseBranch: sql`excluded.base_branch`,
  lastSeq: sql`excluded.last_seq`,
  createdAt: sql`excluded.created_at`,
  archivedAt: sql`excluded.archived_at`,
};

export function saveSessionSummaries(db: Db, workspaceId: string, list: SessionSummary[]): void {
  const rows = list.map((s) => toSessionRow(workspaceId, s));
  db.transaction((tx) => {
    for (const part of chunks(rows)) {
      tx.insert(sessions)
        .values(part)
        .onConflictDoUpdate({ target: sessions.id, set: overwriteAll })
        .run();
    }
  });
}

function archivedCondition(archived: boolean | undefined) {
  if (archived === undefined) return undefined;
  return archived ? isNotNull(sessions.archivedAt) : isNull(sessions.archivedAt);
}

export function listSessions(db: Db, filter?: { archived?: boolean }): StoredSession[] {
  const rows = db
    .select()
    .from(sessions)
    .where(archivedCondition(filter?.archived))
    .orderBy(desc(sessions.createdAt))
    .all();
  return rows.map(toStoredSession);
}

export function getSession(db: Db, sessionId: SessionId): StoredSession | undefined {
  const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  return row && toStoredSession(row);
}
