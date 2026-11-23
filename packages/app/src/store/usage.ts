import type { UsageRow } from "@agentcontrol/protocol";
import { and, asc, eq } from "drizzle-orm";
import { chunks, type Db } from "./db.ts";
import { usage } from "./schema.ts";

type Saved = typeof usage.$inferSelect;

/** A saved usage row and the workspace of its session (session ids are only unique per workspace). */
export type StoredUsage = UsageRow & { workspaceId: string };

function toSaved(call: { workspaceId: string; row: UsageRow; idx: number }): Saved {
  const { workspaceId, row, idx } = call;
  return {
    workspaceId,
    sessionId: row.sessionId,
    idx,
    ts: row.ts,
    model: row.model ?? null,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cacheReadTokens: row.cacheReadTokens,
    cacheWriteTokens: row.cacheWriteTokens,
    costUsd: row.costUsd ?? null,
  };
}

function toStoredUsage(saved: Saved): StoredUsage {
  const { model, costUsd, workspaceId, sessionId, ts } = saved;
  return {
    workspaceId,
    sessionId,
    ts,
    inputTokens: saved.inputTokens,
    outputTokens: saved.outputTokens,
    cacheReadTokens: saved.cacheReadTokens,
    cacheWriteTokens: saved.cacheWriteTokens,
    source: "acp",
    ...(model === null ? {} : { model }),
    ...(costUsd === null ? {} : { costUsd }),
  };
}

/** Numbers each session's rows from 0 in the order they come. */
function numbered(call: { workspaceId: string; rows: UsageRow[] }): Saved[] {
  const counts = new Map<string, number>();
  return call.rows.map((row) => {
    const idx = counts.get(row.sessionId) ?? 0;
    counts.set(row.sessionId, idx + 1);
    return toSaved({ workspaceId: call.workspaceId, row, idx });
  });
}

/** Replaces the saved rows of these sessions with the relay's lists, in one transaction. */
export function replaceUsage(
  db: Db,
  call: { workspaceId: string; sessionIds: string[]; rows: UsageRow[] },
): void {
  const { workspaceId, sessionIds, rows } = call;
  const saved = numbered({ workspaceId, rows });
  db.transaction((tx) => {
    for (const sessionId of sessionIds) {
      tx.delete(usage)
        .where(and(eq(usage.workspaceId, workspaceId), eq(usage.sessionId, sessionId)))
        .run();
    }
    for (const part of chunks(saved)) tx.insert(usage).values(part).run();
  });
}

/** Every saved row of every workspace, oldest first within each session. */
export function listUsage(db: Db): StoredUsage[] {
  return db
    .select()
    .from(usage)
    .orderBy(asc(usage.workspaceId), asc(usage.sessionId), asc(usage.idx))
    .all()
    .map(toStoredUsage);
}
