import { byAgent, byDay, byModel, byRepository, byWorkspace } from "./breakdowns.ts";
import type { Collected } from "./collect.ts";
import { addTokens } from "./tokens.ts";
import type { AnalyticsSummary, AnalyticsTotals, SessionAnalytics } from "./types.ts";

const sum = (sessions: SessionAnalytics[], pick: (s: SessionAnalytics) => number): number =>
  sessions.reduce((total, session) => total + pick(session), 0);

/** The headline numbers over these sessions. Cost adds only what agents reported. */
function totalsOf(sessions: SessionAnalytics[]): AnalyticsTotals {
  return {
    sessions: sessions.length,
    turns: sum(sessions, (s) => s.turns),
    tokens: addTokens(sessions.map((s) => s.tokens)),
    costUsd: sum(sessions, (s) => s.costUsd ?? 0),
    sessionsWithCost: sessions.filter((s) => s.costUsd !== undefined).length,
    sessionsWithoutCost: sessions.filter((s) => s.noCostReported).length,
    workingMs: sum(sessions, (s) => s.workingMs),
    waitingMs: sum(sessions, (s) => s.waitingMs),
    permissionsRequested: sum(sessions, (s) => s.permissionsRequested),
    permissionsAllowed: sum(sessions, (s) => s.permissionsAllowed),
    permissionsDenied: sum(sessions, (s) => s.permissionsDenied),
    linesAdded: sum(sessions, (s) => s.linesAdded),
    linesRemoved: sum(sessions, (s) => s.linesRemoved),
  };
}

/** Totals and the breakdowns by day, model, agent, workspace and repository. */
export function summarise(call: {
  entries: Collected[];
  tzOffsetMinutes: number;
}): AnalyticsSummary {
  const { entries, tzOffsetMinutes } = call;
  return {
    totals: totalsOf(entries.map((entry) => entry.session)),
    byDay: byDay({ entries, tzOffsetMinutes }),
    byModel: byModel(entries),
    byAgent: byAgent(entries),
    byWorkspace: byWorkspace(entries),
    byRepository: byRepository(entries),
  };
}
