import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";
import type { AnalyticsSessionSort, AnalyticsSummary, Insight, SessionAnalytics } from "./types.ts";

/** What to count. Everything is optional: with no filter, all sessions and all time. */
export interface AnalyticsFilter {
  /** Only what happened at or after this time (an ISO date or date and time). */
  from?: string;
  /** Only what happened before this time. */
  to?: string;
  /** A workspace id from `workspaces.list()`. */
  workspace?: string;
  /** "claude-code", "codex" (or "mock" in tests). */
  agent?: string;
  /** A repository's path. */
  repo?: string;
  /**
   * The viewer's offset from UTC in minutes, east positive (UTC+1 is 60), so the day breakdown
   * starts each day at the viewer's midnight. 0 (UTC) when left out.
   */
  tzOffset?: number;
}

/** The session table's filter, plus how to order and cut the rows. */
export interface AnalyticsTableOptions extends AnalyticsFilter {
  /** What to order by; "recent" (newest session first) when left out. */
  sort?: AnalyticsSessionSort;
  /** "desc" (largest or newest first) when left out. */
  order?: "asc" | "desc";
  /** At most this many rows (200 when left out, 1000 at most). */
  limit?: number;
}

function queryOf(options: AnalyticsTableOptions): Record<string, string> {
  const entries = Object.entries(options).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
}

/**
 * What the sessions cost and how they went, worked out from what the app saved, so it works while a
 * workspace is offline. With a `from`/`to` range only what happened inside it is counted.
 */
export function analyticsApi(api: Api) {
  return {
    /**
     * Totals (sessions, turns, tokens by type, cost, time working vs waiting for you, permissions,
     * changed lines) and breakdowns by day, model, agent, workspace and repository. Cost adds only
     * what agents reported: `sessionsWithoutCost` counts sessions that used tokens and reported no
     * cost (a subscription login), which are never counted as $0.
     */
    summary: (filter: AnalyticsFilter = {}): Promise<AnalyticsSummary> =>
      read(api.analytics.summary.$get({ query: queryOf(filter) })),
    /** One row per session for a table, with the facts worked out from its events. */
    sessions: async (options: AnalyticsTableOptions = {}): Promise<SessionAnalytics[]> => {
      const { sessions } = await read(api.analytics.sessions.$get({ query: queryOf(options) }));
      return sessions;
    },
    /**
     * Short observations found by fixed rules (no model is asked): who waited on you longest, many
     * refused requests, turns cut short, low cache use, cost per changed line, models compared. Each
     * has a plain sentence and the ids of the sessions behind it.
     */
    insights: async (filter: AnalyticsFilter = {}): Promise<Insight[]> => {
      const { insights } = await read(api.analytics.insights.$get({ query: queryOf(filter) }));
      return insights;
    },
  };
}
