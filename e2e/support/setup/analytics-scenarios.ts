import type { SeededSession } from "./seeded-analytics.ts";

/** Two sessions on two days with two models; the first costs $0.05, the second $0.01. */
export const TWO_SESSIONS_TWO_MODELS: SeededSession[] = [
  {
    id: "rate-limiting",
    title: "Add rate limiting",
    startedAt: "2026-01-05T10:00:00Z",
    turns: [
      {
        startsAtSec: 0,
        endsAtSec: 60,
        model: "claude-sonnet-4-5",
        tokens: { input: 1000, output: 200, cacheRead: 3000, cacheWrite: 100 },
        costSoFarUsd: 0.05,
      },
    ],
  },
  {
    id: "login-bug",
    title: "Fix login bug",
    startedAt: "2026-01-06T09:00:00Z",
    turns: [
      {
        startsAtSec: 0,
        endsAtSec: 30,
        model: "claude-haiku-4-5",
        tokens: { input: 500, output: 100, cacheRead: 0, cacheWrite: 0 },
        costSoFarUsd: 0.01,
      },
    ],
  },
];

/** One session that used 1,500 tokens and whose agent reported no cost, as with a subscription login. */
export const SESSION_WITHOUT_COST: SeededSession[] = [
  {
    id: "subscription",
    title: "Tidy the imports",
    startedAt: "2026-01-05T10:00:00Z",
    turns: [
      {
        startsAtSec: 0,
        endsAtSec: 20,
        model: "claude-sonnet-4-5",
        tokens: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 },
      },
    ],
  },
];

/** One session whose agent asked permission at 10s and was answered at 100s: it waited 90s of a 120s turn. */
export const SESSION_THAT_WAITED_90_SECONDS: SeededSession[] = [
  {
    id: "waited",
    title: "Run the tests",
    startedAt: "2026-01-05T10:00:00Z",
    turns: [
      {
        startsAtSec: 0,
        endsAtSec: 120,
        tokens: { input: 10, output: 10, cacheRead: 0, cacheWrite: 0 },
        permissions: [{ askedAtSec: 10, answeredAtSec: 100, answer: "allow" }],
      },
    ],
  },
];
