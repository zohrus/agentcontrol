import { afterEach, test } from "bun:test";
import { expectBreakdown, expectSummaryToCount } from "../support/expect/analytics-expectations.ts";
import { expectSessionTable } from "../support/expect/analytics-insight-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { SESSIONS_OF_TWO_AGENTS_IN_TWO_REPOS } from "../support/setup/insight-scenarios.ts";
import { startAppWithSeededSessions } from "../support/setup/seeded-app.ts";

afterEach(cleanUpAfterTest);

test("the agent filter counts only that agent's sessions", async () => {
  // ********************************************************************
  // ** GIVEN a Mock agent session and a Claude Code session
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSIONS_OF_TWO_AGENTS_IN_TWO_REPOS);

  // ********************************************************************
  // ** WHEN the user filters by Claude Code
  // ********************************************************************
  const filter = { agent: "claude-code" };

  // ********************************************************************
  // ** THEN only the Claude Code session is counted and listed
  // ********************************************************************
  const tokens = { input: 300, output: 100, cacheRead: 0, cacheWrite: 0 };
  await expectSummaryToCount(app, { filter, sessions: 1, turns: 1, tokens });
  await expectSessionTable(app, { filter, titles: ["Beta work"] });
});

test("the repository filter counts only that repository's sessions", async () => {
  // ********************************************************************
  // ** GIVEN a session in /repos/alpha and another in /repos/beta
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSIONS_OF_TWO_AGENTS_IN_TWO_REPOS);

  // ********************************************************************
  // ** WHEN the user filters by /repos/alpha
  // ********************************************************************
  const filter = { repo: "/repos/alpha" };

  // ********************************************************************
  // ** THEN only the alpha session is listed, and the repository breakdown has one entry
  // ********************************************************************
  await expectSessionTable(app, { filter, titles: ["Alpha work"] });
  await expectBreakdown(app, { by: "byRepository", filter, tokens: { "/repos/alpha": 200 } });
});

test("the workspace filter counts only that workspace's sessions", async () => {
  // ********************************************************************
  // ** GIVEN two sessions on this Mac
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSIONS_OF_TWO_AGENTS_IN_TWO_REPOS);

  // ********************************************************************
  // ** WHEN the user filters by a workspace that has none of them
  // ********************************************************************
  const filter = { workspace: "another-machine" };

  // ********************************************************************
  // ** THEN no session is listed
  // ********************************************************************
  await expectSessionTable(app, { filter, titles: [] });
});

test("the date range counts only what happened inside it", async () => {
  // ********************************************************************
  // ** GIVEN a session on 5 January and another on 6 January
  // ********************************************************************
  const app = await startAppWithSeededSessions(SESSIONS_OF_TWO_AGENTS_IN_TWO_REPOS);

  // ********************************************************************
  // ** WHEN the user picks the range of 6 January
  // ********************************************************************
  const filter = { from: "2026-01-06T00:00:00Z", to: "2026-01-07T00:00:00Z" };

  // ********************************************************************
  // ** THEN only the session of 6 January is counted
  // ********************************************************************
  await expectSessionTable(app, { filter, titles: ["Beta work"] });
});
