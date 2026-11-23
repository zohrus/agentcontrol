import type { UsageRow } from "@agentcontrol/protocol";
import type { Store, StoredSession } from "../store/index.ts";
import type { FactsCache, Seen } from "./facts-cache.ts";
import { type Filters, hasRange, inRange } from "./filters.ts";
import { addTokens, reportedCost, tokensOfRow, usedTokens } from "./tokens.ts";
import type { SessionAnalytics, TokenCounts } from "./types.ts";

/** One session's analytics and the usage rows (in range) they come from. */
export type Collected = { session: SessionAnalytics; rows: UsageRow[] };

const keyOf = (workspaceId: string, sessionId: string): string =>
  `${workspaceId}\u0000${sessionId}`;

type Check = (session: StoredSession, filters: Filters) => boolean;

const CHECKS: Check[] = [
  (session) => session.kind !== "directory",
  (session, f) => f.workspaceId === undefined || session.workspaceId === f.workspaceId,
  (session, f) => f.agent === undefined || session.agent === f.agent,
  (session, f) => f.repoPath === undefined || session.repoPath === f.repoPath,
];

const wanted = (session: StoredSession, filters: Filters): boolean =>
  CHECKS.every((check) => check(session, filters));

/** The model that used the most tokens, if any turn named one. */
function mainModelOf(rows: UsageRow[]): string | undefined {
  const byModel = new Map<string, number>();
  for (const row of rows) {
    if (row.model !== undefined) {
      byModel.set(row.model, (byModel.get(row.model) ?? 0) + tokensOfRow(row).total);
    }
  }
  return [...byModel].toSorted((a, b) => b[1] - a[1])[0]?.[0];
}

/** The fields that exist only when known, so none is ever `undefined`. */
function whenKnown(call: { model: string | undefined; cost: number | undefined }) {
  const { model, cost } = call;
  return {
    ...(model === undefined ? {} : { model }),
    ...(cost === undefined ? {} : { costUsd: cost }),
  };
}

function describe(call: {
  session: StoredSession;
  seen: Seen;
  rows: UsageRow[];
  workspaces: Map<string, string>;
}): SessionAnalytics {
  const { session, seen, rows, workspaces } = call;
  const tokens: TokenCounts = addTokens(rows.map(tokensOfRow));
  const cost = reportedCost(rows);
  return {
    ...seen.facts,
    sessionId: session.id,
    workspaceId: session.workspaceId,
    workspace: workspaces.get(session.workspaceId) ?? session.workspaceId,
    title: session.title,
    agent: session.agent,
    repoPath: session.repoPath,
    tokens,
    tokenTurns: rows.filter(usedTokens).length,
    noCostReported: tokens.total > 0 && cost === undefined,
    archived: session.archivedAt !== undefined,
    failed: session.status === "failed",
    createdAt: session.createdAt,
    ...whenKnown({ model: mainModelOf(rows), cost }),
  };
}

function usageBySession(store: Store, filters: Filters): Map<string, UsageRow[]> {
  const grouped = new Map<string, UsageRow[]>();
  for (const { workspaceId, ...row } of store.listUsage()) {
    if (!inRange(row.ts, filters)) continue;
    const key = keyOf(workspaceId, row.sessionId);
    const rows = grouped.get(key) ?? [];
    rows.push(row);
    grouped.set(key, rows);
  }
  return grouped;
}

/** The highest saved seq of every session, per workspace: one query each, not one per session. */
function lastSeqsOf(store: Store): Map<string, Record<string, number>> {
  return new Map(store.listWorkspaces().map((w) => [w.id, store.lastSeqs(w.id)]));
}

/**
 * The sessions that match the filters, each with its facts and tokens. With a time range, only what
 * happened inside it is counted, and a session with nothing inside it is left out. Everything is
 * read from the app's own store, so it works while a workspace is offline.
 */
export function collectSessions(call: {
  store: Store;
  cache: FactsCache;
  filters: Filters;
  now: number;
}): Collected[] {
  const { store, cache, filters, now } = call;
  const workspaces = new Map(store.listWorkspaces().map((w) => [w.id, w.label]));
  const usage = usageBySession(store, filters);
  const seqs = lastSeqsOf(store);
  return store
    .listSessions()
    .filter((session) => wanted(session, filters))
    .map((session) => {
      const lastSeq = seqs.get(session.workspaceId)?.[session.id] ?? 0;
      const seen = cache.seenIn({ store, session, filters, lastSeq, now });
      const rows = usage.get(keyOf(session.workspaceId, session.id)) ?? [];
      const empty = seen.eventCount === 0 && rows.length === 0;
      return { session: describe({ session, seen, rows, workspaces }), rows, empty };
    })
    .filter((entry) => !(hasRange(filters) && entry.empty))
    .map(({ session, rows }) => ({ session, rows }));
}
