import { afterEach, test } from "bun:test";
import { expectSummaryToCount } from "../support/expect/analytics-expectations.ts";
import { expectSessionTable } from "../support/expect/analytics-insight-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { anAppDatabaseFromBeforeTheUsageTable } from "../support/setup/old-database.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("an app database from before the usage table is upgraded and its sessions stay in the analytics", async () => {
  // ********************************************************************
  // ** GIVEN the database of the release before the usage table, holding one finished session
  // ********************************************************************
  const beforeTheAppStarts = anAppDatabaseFromBeforeTheUsageTable;

  // ********************************************************************
  // ** WHEN the new app starts on that data folder
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ beforeTheAppStarts });

  // ********************************************************************
  // ** THEN the analytics work and still count that session and its turn
  // ********************************************************************
  const noTokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  await expectSummaryToCount(app, { sessions: 1, turns: 1, tokens: noTokens });
  // AND the session is in the table under its own title
  await expectSessionTable(app, { titles: ["Written last month"] });
});
