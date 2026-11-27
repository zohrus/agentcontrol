import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import { expectQueueNoteToSay, expectQueueToHold } from "../support/browser/queue-expectations.ts";
import { aSessionBeingCancelledWithAQueuedMessage } from "../support/browser/queue-setups.ts";
import { expectStreamNotToShow } from "../support/browser/rendering-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "after Cancel the queued message is kept and not sent by itself",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent works until cancelled, with a message waiting in the queue
    // ********************************************************************
    const app = await startAppInBrowser();
    await aSessionBeingCancelledWithAQueuedMessage(app, "Now do the other thing");

    // ********************************************************************
    // ** WHEN the user presses Cancel and the turn ends
    // ********************************************************************
    await app.page.cancelsTheTurn();
    await expectStreamToShow(app, "Turn ended · cancelled");

    // ********************************************************************
    // ** THEN the message is still in the queue, which says it is held, and the agent did not get it
    // ********************************************************************
    await expectQueueToHold(app, "Now do the other thing");
    await expectQueueNoteToSay(app, "held after Cancel");
    await expectStreamNotToShow(app, "Now do the other thing");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Send now sends the first message of a queue that Cancel held back",
  async () => {
    // ********************************************************************
    // ** GIVEN a cancelled turn with a message held in the queue
    // ********************************************************************
    const app = await startAppInBrowser();
    await aSessionBeingCancelledWithAQueuedMessage(app, "Now do the other thing");
    await app.page.cancelsTheTurn();
    await expectQueueNoteToSay(app, "held after Cancel");

    // ********************************************************************
    // ** WHEN the user presses Send now on it
    // ********************************************************************
    await app.page.sendsTheQueuedMessageNow("Now do the other thing");

    // ********************************************************************
    // ** THEN the agent gets the message and answers it, and the queue is empty
    // ********************************************************************
    await expectStreamToShowAll(app, "Now do the other thing", "Done after cancel");
    await expectQueueToHold(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
