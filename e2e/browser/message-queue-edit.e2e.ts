import { afterEach, test } from "bun:test";
import { expectMessageBoxToHold } from "../support/browser/message-box-expectations.ts";
import { expectQueueToHold } from "../support/browser/queue-expectations.ts";
import { aBusySessionWithQueuedMessages } from "../support/browser/queue-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "Edit takes a queued message out of the queue and puts its text back in the box",
  async () => {
    // ********************************************************************
    // ** GIVEN a busy session with one message waiting in the queue
    // ********************************************************************
    const app = await startAppInBrowser();
    await aBusySessionWithQueuedMessages(app, "Also add tests");

    // ********************************************************************
    // ** WHEN the user presses Edit on it
    // ********************************************************************
    await app.page.editsTheQueuedMessage("Also add tests");

    // ********************************************************************
    // ** THEN the queue is empty and the box holds the message
    // ********************************************************************
    await expectQueueToHold(app);
    await expectMessageBoxToHold(app, "Also add tests");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Edit keeps what was already written in the box, after the queued text and a blank line",
  async () => {
    // ********************************************************************
    // ** GIVEN a busy session with one queued message, and some text already in the box
    // ********************************************************************
    const app = await startAppInBrowser();
    await aBusySessionWithQueuedMessages(app, "Also add tests");
    await app.page.writesWithoutSending("And update the docs");

    // ********************************************************************
    // ** WHEN the user presses Edit on the queued message
    // ********************************************************************
    await app.page.editsTheQueuedMessage("Also add tests");

    // ********************************************************************
    // ** THEN the box holds the queued text first, a blank line, then the text that was there
    // ********************************************************************
    await expectMessageBoxToHold(app, "Also add tests\n\nAnd update the docs");
    await expectQueueToHold(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
