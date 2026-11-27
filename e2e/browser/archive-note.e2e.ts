import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { opensSessionWithUncommittedEdit } from "../support/browser/open-session-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "an archived session says the agent was stopped, not that it exited with a signal",
  async () => {
    // ********************************************************************
    // ** GIVEN a session with an uncommitted edit, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await opensSessionWithUncommittedEdit(app, "Reword the readme");

    // ********************************************************************
    // ** WHEN the user archives it anyway, and opens it under Archived
    // ********************************************************************
    await app.page.archives();
    await app.page.archivesAnyway();
    await app.page.showsArchivedSessions();
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the conversation says the agent was stopped
    // ********************************************************************
    await expectStreamToShow(app, "The agent was stopped");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
