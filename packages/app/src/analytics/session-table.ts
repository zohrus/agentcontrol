import { z } from "zod";
import { FilterQuery } from "./filters.ts";
import type { AnalyticsSessionSort, SessionAnalytics } from "./types.ts";

const SORTS = [
  "recent",
  "title",
  "agent",
  "model",
  "workspace",
  "turns",
  "tokens",
  "cost",
  "working",
  "waiting",
  "lines",
] as const satisfies readonly AnalyticsSessionSort[];

/** The query of the session table: the usual filters, how to order the rows and how many to send. */
export const TableQuery = FilterQuery.extend({
  sort: z.enum(SORTS).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z
    .string()
    .regex(/^[1-9]\d{0,3}$/)
    .optional(),
});

/** The table's options with their defaults: newest first, 200 rows. */
export function tableOptionsOf(query: z.infer<typeof TableQuery>) {
  const limit = Math.min(Number(query.limit ?? 200), 1000);
  return { sort: query.sort ?? "recent", order: query.order ?? "desc", limit } as const;
}

type Value = string | number;

/** What each sort looks at. A session with no cost reported sorts below every priced one. */
const SORT_VALUES: Record<AnalyticsSessionSort, (session: SessionAnalytics) => Value> = {
  recent: (s) => s.createdAt,
  title: (s) => s.title.toLowerCase(),
  agent: (s) => s.agent,
  model: (s) => s.model ?? "",
  workspace: (s) => s.workspace.toLowerCase(),
  turns: (s) => s.turns,
  tokens: (s) => s.tokens.total,
  cost: (s) => s.costUsd ?? -1,
  working: (s) => s.workingMs,
  waiting: (s) => s.waitingMs,
  lines: (s) => s.linesAdded + s.linesRemoved,
};

const compare = (a: Value, b: Value): number => Number(a > b) - Number(a < b);

/** The sessions in the asked order, at most `limit` of them. */
export function sortedSessions(call: {
  sessions: SessionAnalytics[];
  sort: AnalyticsSessionSort;
  order: "asc" | "desc";
  limit: number;
}): SessionAnalytics[] {
  const { sessions, sort, order, limit } = call;
  const value = SORT_VALUES[sort];
  const direction = order === "asc" ? 1 : -1;
  return sessions
    .toSorted(
      (a, b) => direction * compare(value(a), value(b)) || a.sessionId.localeCompare(b.sessionId),
    )
    .slice(0, limit);
}
