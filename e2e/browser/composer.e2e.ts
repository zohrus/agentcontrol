import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "Cancel stops a turn that is still running",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent keeps working until it is cancelled, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWaitUntilCancelled();
    const session = await app.user.startsSession({ prompt: "Index the whole monorepo" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user presses Cancel
    // ********************************************************************
    await app.page.cancelsTheTurn();

    // ********************************************************************
    // ** THEN the conversation says the turn ended as cancelled
    // ********************************************************************
    await expectStreamToShow(app, "Turn ended · cancelled");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Ctrl+Enter sends the message in the box and does nothing when the box is empty",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in the browser whose agent answered "First answer"
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReply("First answer");
    app.mockAgent.onNextPrompt();
    app.mockAgent.willReply("Second answer");
    const session = await app.user.startsSession({ prompt: "Say hello" });
    await app.page.opensSession(session.title);
    await expectStreamToShow(app, "First answer");

    // ********************************************************************
    // ** WHEN the user presses Ctrl+Enter in the empty box, then types a message and presses Ctrl+Enter
    // ********************************************************************
    await app.page.sendsMessageWithTheKeyboard("");
    await app.page.sendsMessageWithTheKeyboard("And again?");

    // ********************************************************************
    // ** THEN the message and the agent's second answer are in the conversation
    // ********************************************************************
    await expectStreamToShowAll(app, "And again?", "Second answer");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
