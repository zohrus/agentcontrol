import type { UsageRow } from "@agentcontrol/protocol";
import type { Collected } from "./collect.ts";
import { dayOf } from "./filters.ts";
import { addTokens, reportedCost, tokensOfRow, usedTokens } from "./tokens.ts";
import type { Breakdown, SessionAnalytics } from "./types.ts";

/** Part of one session's usage that belongs under one key of a breakdown. */
type Slice = { key: string; label: string; session: SessionAnalytics; rows: UsageRow[] };

const lastSegment = (path: string): string => path.split("/").filter(Boolean).at(-1) ?? path;

/** One slice per session, holding all its rows, under a key the session itself has. */
function sessionSlices(call: {
  entries: Collected[];
  keyOf: (session: SessionAnalytics) => { key: string; label: string };
}): Slice[] {
  return call.entries.map(({ session, rows }) => ({ ...call.keyOf(session), session, rows }));
}

/** One slice per session and key, holding the rows that have the key. */
function rowSlices(call: {
  entries: Collected[];
  keyOf: (row: UsageRow) => { key: string; label: string };
}): Slice[] {
  return call.entries.flatMap(({ session, rows }) => {
    const groups = new Map<string, Slice>();
    for (const row of rows) {
      const { key, label } = call.keyOf(row);
      const slice = groups.get(key) ?? { key, label, session, rows: [] };
      slice.rows.push(row);
      groups.set(key, slice);
    }
    return [...groups.values()];
  });
}

function breakdownOf(key: string, slices: Slice[]): Breakdown {
  const rows = slices.flatMap((slice) => slice.rows);
  return {
    key,
    label: slices[0]?.label ?? key,
    sessions: slices.length,
    turns: rows.filter(usedTokens).length,
    tokens: addTokens(rows.map(tokensOfRow)),
    costUsd: reportedCost(rows) ?? 0,
    sessionsWithoutCost: slices.filter((slice) => slice.session.noCostReported).length,
  };
}

function grouped(slices: Slice[]): Breakdown[] {
  const byKey = new Map<string, Slice[]>();
  for (const slice of slices) {
    const group = byKey.get(slice.key) ?? [];
    group.push(slice);
    byKey.set(slice.key, group);
  }
  return [...byKey].map(([key, group]) => breakdownOf(key, group));
}

const biggestFirst = (a: Breakdown, b: Breakdown): number =>
  b.tokens.total - a.tokens.total || a.key.localeCompare(b.key);

/** Usage per calendar day (oldest first), for a viewer `tzOffsetMinutes` east of UTC. */
export function byDay(call: { entries: Collected[]; tzOffsetMinutes: number }): Breakdown[] {
  const keyOf = (row: UsageRow) => {
    const key = dayOf({ ts: row.ts, tzOffsetMinutes: call.tzOffsetMinutes });
    return { key, label: key };
  };
  return grouped(rowSlices({ entries: call.entries, keyOf })).toSorted((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/** Usage per model, most tokens first; turns that named no model are "Unknown model". */
export function byModel(entries: Collected[]): Breakdown[] {
  const keyOf = (row: UsageRow) => ({
    key: row.model ?? "unknown",
    label: row.model ?? "Unknown model",
  });
  return grouped(rowSlices({ entries, keyOf })).toSorted(biggestFirst);
}

/** Usage per agent ("claude-code", "codex"), most tokens first. */
export function byAgent(entries: Collected[]): Breakdown[] {
  const keyOf = (session: SessionAnalytics) => ({ key: session.agent, label: session.agent });
  return grouped(sessionSlices({ entries, keyOf })).toSorted(biggestFirst);
}

/** Usage per workspace (machine), most tokens first. */
export function byWorkspace(entries: Collected[]): Breakdown[] {
  const keyOf = (session: SessionAnalytics) => ({
    key: session.workspaceId,
    label: session.workspace,
  });
  return grouped(sessionSlices({ entries, keyOf })).toSorted(biggestFirst);
}

/** Usage per repository, most tokens first; the label is the folder's name. */
export function byRepository(entries: Collected[]): Breakdown[] {
  const keyOf = (session: SessionAnalytics) => ({
    key: session.repoPath,
    label: lastSegment(session.repoPath),
  });
  return grouped(sessionSlices({ entries, keyOf })).toSorted(biggestFirst);
}
