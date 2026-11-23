import { byModel } from "./breakdowns.ts";
import type { Collected } from "./collect.ts";
import { cutShortTurnsInsight, longWaits, manyDenied } from "./insights-behaviour.ts";
import { costlyPerLine, lowCacheShare, modelsCompared } from "./insights-cost.ts";
import type { Insight, SessionAnalytics } from "./types.ts";

type Rule = (call: { entries: Collected[]; sessions: SessionAnalytics[] }) => Insight | undefined;

/** Every rule, in the order the observations are listed. Rules only: nothing here calls a model. */
const RULES: Rule[] = [
  ({ sessions }) => longWaits(sessions),
  ({ sessions }) => manyDenied(sessions),
  ({ sessions }) => cutShortTurnsInsight(sessions),
  ({ sessions }) => lowCacheShare(sessions),
  ({ sessions }) => costlyPerLine(sessions),
  ({ entries, sessions }) => modelsCompared({ sessions, models: byModel(entries) }),
];

/** The observations the rules find in these sessions, each with the sessions that show it. */
export function insightsOf(entries: Collected[]): Insight[] {
  const sessions = entries.map((entry) => entry.session);
  return RULES.flatMap((rule) => rule({ entries, sessions }) ?? []);
}
