import type { Insight, SessionAnalytics } from "./types.ts";
import { count, duration, quoted } from "./wording.ts";

/** A session that waited at least this long for the user's answers is worth a mention. */
const LONG_WAIT_MS = 5 * 60_000;
/** This many refused requests in one session is more than a one-off. */
const MANY_DENIED = 3;
/** Stop reasons that mean the agent was cut short. */
const CUT_SHORT = ["max_tokens", "max_turn_requests", "cancelled"];

const mostFirst =
  (value: (s: SessionAnalytics) => number) => (a: SessionAnalytics, b: SessionAnalytics) =>
    value(b) - value(a);

/** Sessions that waited on the user's answers for a long time, the longest first. */
export function longWaits(sessions: SessionAnalytics[]): Insight | undefined {
  const waited = sessions
    .filter((s) => s.waitingMs >= LONG_WAIT_MS)
    .toSorted(mostFirst((s) => s.waitingMs));
  const [longest] = waited;
  if (longest === undefined) return undefined;
  const text = `${count(waited.length, "session")} waited ${duration(LONG_WAIT_MS)} or more for your answer to a permission request; the longest was ${quoted(longest.title)} at ${duration(longest.waitingMs)}.`;
  return { rule: "long-waits", text, sessionIds: waited.map((s) => s.sessionId) };
}

/** Sessions where the user refused many requests. */
export function manyDenied(sessions: SessionAnalytics[]): Insight | undefined {
  const refused = sessions
    .filter((s) => s.permissionsDenied >= MANY_DENIED)
    .toSorted(mostFirst((s) => s.permissionsDenied));
  const [most] = refused;
  if (most === undefined) return undefined;
  const text = `${count(refused.length, "session")} had ${String(MANY_DENIED)} or more permission requests denied; ${quoted(most.title)} had ${String(most.permissionsDenied)}. The agent keeps asking for things you refuse: a rule in its instructions might help.`;
  return { rule: "many-denied", text, sessionIds: refused.map((s) => s.sessionId) };
}

const cutShortTurns = (s: SessionAnalytics): number =>
  CUT_SHORT.reduce((total, reason) => total + (s.stopReasons[reason] ?? 0), 0);

/** Turns that hit a limit or were cancelled. */
export function cutShortTurnsInsight(sessions: SessionAnalytics[]): Insight | undefined {
  const affected = sessions.filter((s) => cutShortTurns(s) > 0).toSorted(mostFirst(cutShortTurns));
  if (affected.length === 0) return undefined;
  const turns = affected.reduce((total, s) => total + cutShortTurns(s), 0);
  const text = `${count(turns, "turn")} in ${count(affected.length, "session")} ended early: they hit a token or step limit, or were cancelled.`;
  return { rule: "cut-short-turns", text, sessionIds: affected.map((s) => s.sessionId) };
}
