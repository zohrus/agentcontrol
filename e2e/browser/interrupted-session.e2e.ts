import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { opensSessionWhoseRelayThenRestarts } from "../support/browser/resume-setups.ts";
import {
  expectResumeNotToBeOffered,
  expectResumeToBeOffered,
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
    await expectStreamToShow(app, "Interrupted: the relay stopped while the agent was running.");
    await expectResumeToBeOffered(app);

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
