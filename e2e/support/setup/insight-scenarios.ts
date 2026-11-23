import type { SeededSession, SeededTurn } from "./seeded-analytics.ts";

const SMALL = { input: 100, output: 100, cacheRead: 800, cacheWrite: 0 };
const TEN_NEW_LINES = {
  path: "src/a.ts",
  oldText: "",
  newText: Array.from({ length: 10 }, (_, n) => `line ${String(n)}`).join("\n"),
};

/** A one-turn session on 5 January; `turn` says what the turn was like. */
function aSession(call: { id: string; title: string; turn: Partial<SeededTurn> }): SeededSession {
  const turn = { startsAtSec: 0, endsAtSec: 60, tokens: SMALL, ...call.turn };
  return { id: call.id, title: call.title, startedAt: "2026-01-05T10:00:00Z", turns: [turn] };
}

/** An ordinary day: short waits, requests allowed, cache used, turns ended normally, one model. */
export const NEUTRAL_SESSIONS: SeededSession[] = [
  aSession({
    id: "calm-1",
    title: "Rename a helper",
    turn: {
      model: "claude-sonnet-4-5",
      costSoFarUsd: 0.02,
      permissions: [{ askedAtSec: 5, answeredAtSec: 35, answer: "allow" }],
      edit: TEN_NEW_LINES,
    },
  }),
  aSession({ id: "calm-2", title: "Update the readme", turn: { model: "claude-sonnet-4-5" } }),
];

/** A session that waited ten minutes for an answer. */
export const SESSION_THAT_WAITED_TEN_MINUTES: SeededSession[] = [
  aSession({
    id: "slow",
    title: "Deploy the preview",
    turn: {
      endsAtSec: 700,
      permissions: [{ askedAtSec: 20, answeredAtSec: 620, answer: "allow" }],
    },
  }),
];

/** A session in which the user refused four requests. */
export const SESSION_WITH_FOUR_DENIALS: SeededSession[] = [
  aSession({
    id: "refused",
    title: "Clean the build folder",
    turn: {
      permissions: [10, 20, 30, 40].map((at) => ({
        askedAtSec: at,
        answeredAtSec: at + 5,
        answer: "deny" as const,
      })),
    },
  }),
];

/** One turn that hit the token limit, and another session whose turn was cancelled. */
export const SESSIONS_CUT_SHORT: SeededSession[] = [
  aSession({ id: "long", title: "Write the migration", turn: { stopReason: "max_tokens" } }),
  aSession({ id: "stopped", title: "Try a refactor", turn: { stopReason: "cancelled" } }),
];

/** A session that sent nearly all its input fresh instead of reading it from the cache. */
export const SESSION_WITH_LITTLE_CACHE: SeededSession[] = [
  aSession({
    id: "uncached",
    title: "Explore the codebase",
    turn: { tokens: { input: 5000, output: 300, cacheRead: 200, cacheWrite: 0 } },
  }),
];

/** Three cheap sessions per changed line and one that cost ten times as much. */
export const SESSIONS_ONE_COSTLY_PER_LINE: SeededSession[] = [
  ...["a", "b", "c"].map((id) =>
    aSession({
      id: `cheap-${id}`,
      title: `Cheap change ${id}`,
      turn: { costSoFarUsd: 0.1, edit: TEN_NEW_LINES },
    }),
  ),
  aSession({
    id: "pricey",
    title: "Pricey change",
    turn: { costSoFarUsd: 1, edit: TEN_NEW_LINES },
  }),
];

/** One session on a model that used ten times the tokens per turn of another. */
export const SESSIONS_ON_TWO_MODELS_OF_VERY_DIFFERENT_SIZE: SeededSession[] = [
  aSession({
    id: "big",
    title: "Redesign the schema",
    turn: {
      model: "claude-opus-4-5",
      tokens: { input: 15000, output: 3000, cacheRead: 2000, cacheWrite: 0 },
    },
  }),
  aSession({
    id: "small",
    title: "Fix a typo",
    turn: {
      model: "claude-haiku-4-5",
      tokens: { input: 1500, output: 300, cacheRead: 200, cacheWrite: 0 },
    },
  }),
];

/** One session on the Mock agent in repo alpha and one on Claude Code in repo beta. */
export const SESSIONS_OF_TWO_AGENTS_IN_TWO_REPOS: SeededSession[] = [
  {
    ...aSession({
      id: "alpha",
      title: "Alpha work",
      turn: { tokens: { input: 100, output: 100, cacheRead: 0, cacheWrite: 0 } },
    }),
    repoPath: "/repos/alpha",
  },
  {
    ...aSession({
      id: "beta",
      title: "Beta work",
      turn: { tokens: { input: 300, output: 100, cacheRead: 0, cacheWrite: 0 } },
    }),
    startedAt: "2026-01-06T10:00:00Z",
    repoPath: "/repos/beta",
    agent: "claude-code",
  },
];
