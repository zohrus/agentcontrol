import { afterEach, test } from "bun:test";
import {
  expectInsightAbout,
  expectInsightToLinkTo,
  expectNoInsights,
} from "../support/expect/analytics-insight-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  NEUTRAL_SESSIONS,
  SESSION_THAT_WAITED_TEN_MINUTES,
  SESSION_WITH_FOUR_DENIALS,
  SESSION_WITH_LITTLE_CACHE,
  SESSIONS_CUT_SHORT,
  SESSIONS_ON_TWO_MODELS_OF_VERY_DIFFERENT_SIZE,
  SESSIONS_ONE_COSTLY_PER_LINE,
} from "../support/setup/insight-scenarios.ts";
import { startAppWithSeededSessions } from "../support/setup/seeded-app.ts";

afterEach(cleanUpAfterTest);

test("an ordinary day has no insights", async () => {
  // ********************************************************************
  // ** GIVEN two ordinary sessions: short waits, requests allowed, the cache used, one model
  // ********************************************************************
  const app = await startAppWithSeededSessions(NEUTRAL_SESSIONS);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN there are none
  // ********************************************************************
  await expectNoInsights(app);
});

test("a session that waited ten minutes for an answer is pointed out", async () => {
  // ********************************************************************
  // ** GIVEN a session whose permission request waited ten minutes
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSION_THAT_WAITED_TEN_MINUTES);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN a "long waits" insight names that session
  // ********************************************************************
  await expectInsightAbout(app, { rule: "long-waits", titles: ["Deploy the preview"] });
});

test("a session with four denied requests is pointed out", async () => {
  // ********************************************************************
  // ** GIVEN a session in which the user refused four permission requests
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSION_WITH_FOUR_DENIALS);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN a "many denied" insight names that session
  // ********************************************************************
  await expectInsightAbout(app, { rule: "many-denied", titles: ["Clean the build folder"] });
});

test("turns that hit the token limit or were cancelled are pointed out", async () => {
  // ********************************************************************
  // ** GIVEN one session whose turn hit max_tokens and one whose turn was cancelled
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSIONS_CUT_SHORT);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN a "cut short" insight names both sessions
  // ********************************************************************
  await expectInsightAbout(app, {
    rule: "cut-short-turns",
    titles: ["Write the migration", "Try a refactor"],
  });
});

test("a session that barely used the cache is pointed out", async () => {
  // ********************************************************************
  // ** GIVEN a session where 96% of the input was sent fresh
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSION_WITH_LITTLE_CACHE);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN a "low cache share" insight names that session
  // ********************************************************************
  await expectInsightAbout(app, { rule: "low-cache-share", titles: ["Explore the codebase"] });
});

test("a session that cost ten times the median per changed line is pointed out", async () => {
  // ********************************************************************
  // ** GIVEN three sessions at $0.01 per changed line and one at $0.10
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSIONS_ONE_COSTLY_PER_LINE);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN a "costly per line" insight names only the expensive one
  // ********************************************************************
  await expectInsightAbout(app, { rule: "costly-per-line", titles: ["Pricey change"] });
});

test("two models that differ tenfold in tokens per turn are compared", async () => {
  // ********************************************************************
  // ** GIVEN a session on Opus using 20,000 tokens in its turn and one on Haiku using 2,000
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSIONS_ON_TWO_MODELS_OF_VERY_DIFFERENT_SIZE);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN a "models compared" insight names both sessions
  // ********************************************************************
  await expectInsightAbout(app, {
    rule: "models-compared",
    titles: ["Redesign the schema", "Fix a typo"],
  });
});

test("an insight links to its session with the workspace the session is in", async () => {
  // ********************************************************************
  // ** GIVEN a session on this Mac whose permission request waited ten minutes
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSION_THAT_WAITED_TEN_MINUTES);

  // ********************************************************************
  // ** WHEN the user reads the insights
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN the "long waits" link names the local workspace and the session's title
  // ********************************************************************
  await expectInsightToLinkTo(app, {
    rule: "long-waits",
    workspaceId: "local",
    title: "Deploy the preview",
  });
});
