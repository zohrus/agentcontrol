import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { opensSessionWhoseRelayThenRestarts } from "../support/browser/resume-setups.ts";
import {
  expectInboxToCount,
  expectResumeNotToBeOffered,
  expectResumeToBeOffered,
  expectSessionRowToShowResumeBadge,
  expectStatusBarToCountWaiting,
  expectStreamNotToShow,
} from "../support/browser/resume-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a session whose agent stopped with the relay says so and offers Resume, which starts a new agent",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in the browser whose relay stopped and started again with its agent
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionWhoseRelayThenRestarts(app);

    // ********************************************************************
    // ** THEN the conversation says it was interrupted, and Resume is offered
    // ********************************************************************
    await expectStreamToShow(app, "The agent was interrupted when the relay stopped.");
    await expectResumeToBeOffered(app);
    // AND no separate line about the agent exiting, and nothing reads "null"
    await expectStreamNotToShow(app, "The agent exited");
    await expectStreamNotToShow(app, "The agent was stopped");
    await expectStreamNotToShow(app, "null");

    // ********************************************************************
    // ** WHEN the user presses Resume
    // ********************************************************************
    await app.page.resumes();

    // ********************************************************************
    // ** THEN the conversation says what the new agent remembers, and Resume is gone
    // ********************************************************************
    await expectStreamToShow(app, "Earlier context was not restored");
    await expectResumeNotToBeOffered(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an interrupted session counts as waiting on you in the list, the Inbox and the status bar",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent stopped when the relay did
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await opensSessionWhoseRelayThenRestarts(app);

    // ********************************************************************
    // ** WHEN the user looks at the session list
    // ********************************************************************
    // (the list is already on screen)

    // ********************************************************************
    // ** THEN the session's row says to resume it
    // ********************************************************************
    await expectSessionRowToShowResumeBadge(app, session.title);
    // AND the Inbox counts it
    await expectInboxToCount(app, 1);
    // AND the status bar counts it
    await expectStatusBarToCountWaiting(app, 1);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
