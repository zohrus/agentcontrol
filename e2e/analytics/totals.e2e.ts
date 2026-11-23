import { afterEach, test } from "bun:test";
import {
  expectBreakdown,
  expectSessionToHaveNoCostReported,
  expectSummaryCost,
  expectSummaryToCount,
  expectTimeSplit,
} from "../support/expect/analytics-expectations.ts";
import {
  SESSION_THAT_WAITED_90_SECONDS,
  SESSION_WITHOUT_COST,
  TWO_SESSIONS_TWO_MODELS,
} from "../support/setup/analytics-scenarios.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSeededSessions } from "../support/setup/seeded-app.ts";

afterEach(cleanUpAfterTest);

test("totals add up across two sessions that used two models", async () => {
  // ********************************************************************
  // ** GIVEN two finished sessions: one on Sonnet costing $0.05, one on Haiku costing $0.01
  // ********************************************************************
  const app = await startAppWithSeededSessions(TWO_SESSIONS_TWO_MODELS);

  // ********************************************************************
  // ** WHEN the user reads the analytics summary
  // ********************************************************************
  // (the summary is read by the checks below)

  // ********************************************************************
  // ** THEN it counts both sessions and adds their tokens of every kind and their cost
  // ********************************************************************
  const tokens = { input: 1500, output: 300, cacheRead: 3000, cacheWrite: 100 };
  await expectSummaryToCount(app, { sessions: 2, turns: 2, tokens });
  await expectSummaryCost(app, { costUsd: 0.06, sessionsWithoutCost: 0 });
  // AND the model breakdown lists Sonnet (4,300 tokens) before Haiku (600)
  await expectBreakdown(app, {
    by: "byModel",
    tokens: { "claude-sonnet-4-5": 4300, "claude-haiku-4-5": 600 },
  });
});

test("usage lands on the day it happened", async () => {
  // ********************************************************************
  // ** GIVEN a session on 5 January and another on 6 January
  // ********************************************************************
  const app = await startAppWithSeededSessions(TWO_SESSIONS_TWO_MODELS);

  // ********************************************************************
  // ** WHEN the user reads the analytics summary
  // ********************************************************************
  // (the summary is read by the check below)

  // ********************************************************************
  // ** THEN the day breakdown has 4,300 tokens on the 5th and 600 on the 6th
  // ********************************************************************
  await expectBreakdown(app, {
    by: "byDay",
    tokens: { "2026-01-05": 4300, "2026-01-06": 600 },
  });
});

test("a session whose agent reported no cost is marked so and not counted as $0", async () => {
  // ********************************************************************
  // ** GIVEN a session that used 1,500 tokens and whose agent reported no cost
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSION_WITHOUT_COST);

  // ********************************************************************
  // ** WHEN the user reads the analytics
  // ********************************************************************
  // (the summary and table are read by the checks below)

  // ********************************************************************
  // ** THEN the session says no cost was reported and the summary counts it as a session without cost
  // ********************************************************************
  await expectSessionToHaveNoCostReported(app, "Tidy the imports");
  await expectSummaryCost(app, { costUsd: 0, sessionsWithoutCost: 1 });
});

test("waiting time is measured from the permission request to its answer", async () => {
  // ********************************************************************
  // ** GIVEN a 120 second turn in which a permission request waited from 10s to 100s
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSION_THAT_WAITED_90_SECONDS);

  // ********************************************************************
  // ** WHEN the user reads the session's analytics
  // ********************************************************************
  // (the table is read by the check below)

  // ********************************************************************
  // ** THEN it waited 90 seconds and worked the other 30
  // ********************************************************************
  await expectTimeSplit(app, { title: "Run the tests", workingSec: 30, waitingSec: 90 });
});
