import type { z } from "zod";
import type { Store } from "../store/index.ts";
import { collectSessions } from "./collect.ts";
import { createFactsCache } from "./facts-cache.ts";
import { filtersOf, FilterQuery } from "./filters.ts";
import { insightsOf } from "./insights.ts";
import { sortedSessions, TableQuery, tableOptionsOf } from "./session-table.ts";
import { summarise } from "./summary.ts";
import type { AnalyticsSummary, Insight, SessionAnalytics } from "./types.ts";

export { FilterQuery, TableQuery };
export { saveUsageOf, saveUsageOfAll } from "./usage-sync.ts";
export type {
  AnalyticsSessionSort,
  AnalyticsSummary,
  AnalyticsTotals,
  Breakdown,
  Insight,
  SessionAnalytics,
  SessionFacts,
  TokenCounts,
} from "./types.ts";

export interface Analytics {
  /** Totals and breakdowns by day, model, agent, workspace and repository. */
  summary(query: z.infer<typeof FilterQuery>): AnalyticsSummary;
  /** One row per session, ordered and cut to `limit`. */
  sessions(query: z.infer<typeof TableQuery>): SessionAnalytics[];
  /** The observations the rules find, each with the sessions behind it. */
  insights(query: z.infer<typeof FilterQuery>): Insight[];
}

/**
 * Analytics over what the app has saved: sessions, events and usage rows. Nothing here asks a relay
 * or an agent, so it works while a workspace is offline. `now` ends the waiting of a session that
 * is still waiting; it is the real clock unless a test passes another.
 */
export function createAnalytics(call: { store: Store; now?: () => number }): Analytics {
  const { store } = call;
  const now = call.now ?? Date.now;
  const cache = createFactsCache();
  const collect = (query: z.infer<typeof FilterQuery>) => {
    const filters = filtersOf(query);
    return { filters, entries: collectSessions({ store, cache, filters, now: now() }) };
  };
  return {
    summary: (query) => {
      const { filters, entries } = collect(query);
      return summarise({ entries, tzOffsetMinutes: filters.tzOffsetMinutes });
    },
    sessions: (query) => {
      const sessions = collect(query).entries.map((entry) => entry.session);
      return sortedSessions({ sessions, ...tableOptionsOf(query) });
    },
    insights: (query) => insightsOf(collect(query).entries),
  };
}
