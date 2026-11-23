import type { AnalyticsFilter, AnalyticsSummary } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";

const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

function fail(expectation: string, saw: unknown): never {
  throw new Error(`${expectation}, but it is ${JSON.stringify(saw)}`);
}

/** The summary counts this many sessions, turns and tokens of each kind. */
export async function expectSummaryToCount(
  app: AppAccess,
  call: {
    filter?: AnalyticsFilter;
    sessions: number;
    turns: number;
    tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  },
): Promise<void> {
  const { totals } = await app.sdk.analytics.summary(call.filter ?? {});
  const { input, output, cacheRead, cacheWrite } = totals.tokens;
  const seen = {
    sessions: totals.sessions,
    turns: totals.turns,
    input,
    output,
    cacheRead,
    cacheWrite,
  };
  const wanted = { sessions: call.sessions, turns: call.turns, ...call.tokens };
  if (JSON.stringify(seen) !== JSON.stringify(wanted)) {
    fail(`expected the summary to count ${JSON.stringify(wanted)}`, seen);
  }
}

/** The summary adds up this much reported cost, leaving this many sessions without a cost out of it. */
export async function expectSummaryCost(
  app: AppAccess,
  call: { costUsd: number; sessionsWithoutCost: number },
): Promise<void> {
  const { totals } = await app.sdk.analytics.summary({});
  if (
    same(totals.costUsd, call.costUsd) &&
    totals.sessionsWithoutCost === call.sessionsWithoutCost
  ) {
    return;
  }
  const seen = { costUsd: totals.costUsd, sessionsWithoutCost: totals.sessionsWithoutCost };
  fail(`expected the summary to report ${JSON.stringify(call)}`, seen);
}

function describeSlices(slices: AnalyticsSummary["byDay"]): Record<string, number> {
  return Object.fromEntries(slices.map((slice) => [slice.key, slice.tokens.total]));
}

/** The breakdown has exactly these keys with these token totals. */
export async function expectBreakdown(
  app: AppAccess,
  call: {
    by: "byDay" | "byModel" | "byAgent" | "byWorkspace" | "byRepository";
    filter?: AnalyticsFilter;
    tokens: Record<string, number>;
  },
): Promise<void> {
  const summary = await app.sdk.analytics.summary(call.filter ?? {});
  const seen = describeSlices(summary[call.by]);
  if (JSON.stringify(seen) !== JSON.stringify(call.tokens)) {
    fail(`expected the ${call.by} breakdown to be ${JSON.stringify(call.tokens)}`, seen);
  }
}

/** The session's table row says it used tokens but the agent reported no cost, and shows no cost at all. */
export async function expectSessionToHaveNoCostReported(
  app: AppAccess,
  title: string,
): Promise<void> {
  const rows = await app.sdk.analytics.sessions({});
  const row = rows.find((candidate) => candidate.title === title);
  if (row?.noCostReported === true && row.costUsd === undefined) return;
  fail(`expected session "${title}" to have no cost reported`, row);
}

/** The session spent this long working and this long waiting for the user, in seconds. */
export async function expectTimeSplit(
  app: AppAccess,
  call: { title: string; workingSec: number; waitingSec: number },
): Promise<void> {
  const rows = await app.sdk.analytics.sessions({});
  const row = rows.find((candidate) => candidate.title === call.title);
  const seen = row && { workingSec: row.workingMs / 1000, waitingSec: row.waitingMs / 1000 };
  if (seen?.workingSec === call.workingSec && seen.waitingSec === call.waitingSec) return;
  fail(`expected session "${call.title}" to have worked and waited ${JSON.stringify(call)}`, seen);
}
