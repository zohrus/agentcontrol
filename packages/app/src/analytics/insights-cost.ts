import { pointingAt } from "./insight-sessions.ts";
import type { Breakdown, Insight, SessionAnalytics } from "./types.ts";
import { count, dollars, percent, quoted } from "./wording.ts";

/** Fewer fresh and cached tokens than this is too little to say anything about. */
const MIN_INPUT_TOKENS = 1000;
/** Below this share of cache reads, much of the input is paid for in full. */
const LOW_CACHE_SHARE = 0.5;
/** A session costing this many times the median per changed line stands out. */
const OUTLIER_FACTOR = 3;
/** The median needs a few sessions to mean something. */
const MIN_PRICED_SESSIONS = 3;
/** One model using this many times the tokens per turn of another is worth showing. */
const MODEL_GAP = 2;

const freshInput = (s: SessionAnalytics): number => s.tokens.input + s.tokens.cacheWrite;
const inputSide = (s: SessionAnalytics): number => freshInput(s) + s.tokens.cacheRead;

/** Whether most of the input was read from the cache (cheap) or sent fresh. */
export function lowCacheShare(sessions: SessionAnalytics[]): Insight | undefined {
  const total = sessions.reduce((sum, s) => sum + inputSide(s), 0);
  const reads = sessions.reduce((sum, s) => sum + s.tokens.cacheRead, 0);
  if (total < MIN_INPUT_TOKENS || reads / total >= LOW_CACHE_SHARE) return undefined;
  const fresh = sessions.toSorted((a, b) => freshInput(b) - freshInput(a));
  const text = `Only ${percent(reads / total)} of the input tokens were cache reads, which are cheap; ${percent(1 - reads / total)} were sent fresh. Long sessions that keep their context steady use the cache more.`;
  return { rule: "low-cache-share", text, ...pointingAt(fresh.slice(0, 5)) };
}

const costPerLine = (s: SessionAnalytics): number =>
  (s.costUsd ?? 0) / Math.max(1, s.linesAdded + s.linesRemoved);

const median = (values: number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const low = sorted[middle - 1] ?? 0;
  const high = sorted[middle] ?? 0;
  return sorted.length % 2 === 0 ? (low + high) / 2 : high;
};

/** Sessions whose cost per changed line is far above the median. Only sessions with a reported cost count. */
export function costlyPerLine(sessions: SessionAnalytics[]): Insight | undefined {
  const priced = sessions.filter(
    (s) => s.costUsd !== undefined && s.costUsd > 0 && s.linesAdded + s.linesRemoved > 0,
  );
  if (priced.length < MIN_PRICED_SESSIONS) return undefined;
  const typical = median(priced.map(costPerLine));
  const outliers = priced
    .filter((s) => costPerLine(s) > OUTLIER_FACTOR * typical)
    .toSorted((a, b) => costPerLine(b) - costPerLine(a));
  const [worst] = outliers;
  if (worst === undefined) return undefined;
  const text = `${count(outliers.length, "session")} cost more than ${String(OUTLIER_FACTOR)}x the median per changed line (${dollars(typical)}); ${quoted(worst.title)} cost ${dollars(costPerLine(worst))} per line.`;
  return { rule: "costly-per-line", text, ...pointingAt(outliers) };
}

const perTurn = (model: Breakdown): number => model.tokens.total / Math.max(1, model.turns);

/** Models compared on tokens per turn, when two of them differ a lot. */
export function modelsCompared(call: {
  sessions: SessionAnalytics[];
  models: Breakdown[];
}): Insight | undefined {
  const used = call.models
    .filter((model) => model.turns > 0)
    .toSorted((a, b) => perTurn(b) - perTurn(a));
  const heaviest = used[0];
  const lightest = used.at(-1);
  if (heaviest === undefined || lightest === undefined) return undefined;
  if (used.length < 2 || perTurn(heaviest) < MODEL_GAP * perTurn(lightest)) return undefined;
  const text = `${heaviest.label} used ${Math.round(perTurn(heaviest)).toLocaleString("en-US")} tokens per turn, ${(perTurn(heaviest) / perTurn(lightest)).toFixed(1)}x ${lightest.label} (${Math.round(perTurn(lightest)).toLocaleString("en-US")}).`;
  const behind = call.sessions.filter((s) => s.model === heaviest.key || s.model === lightest.key);
  return { rule: "models-compared", text, ...pointingAt(behind) };
}
