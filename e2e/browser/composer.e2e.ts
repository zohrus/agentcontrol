import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { opensSessionThatAnswersTwice } from "../support/browser/more-session-setups.ts";
import { expectMessageBoxToHold } from "../support/browser/message-box-expectations.ts";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import { expectStreamNotToShow } from "../support/browser/rendering-expectations.ts";
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
  "Shift+Enter sends the message in the box without adding a line",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in the browser whose agent answered "First answer"
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionThatAnswersTwice(app);

    // ********************************************************************
    // ** WHEN the user types a message and presses Shift+Enter
    // ********************************************************************
    await app.page.sendsMessageWithShiftEnter("And again?");

    // ********************************************************************
    // ** THEN the message and the agent's second answer are in the conversation, and the box is empty
    // ********************************************************************
    await expectStreamToShowAll(app, "And again?", "Second answer");
    await expectMessageBoxToHold(app, "");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Enter alone adds a new line and sends nothing",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in the browser whose agent answered "First answer"
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionThatAnswersTwice(app);

    // ********************************************************************
    // ** WHEN the user types a line and presses Enter
    // ********************************************************************
    await app.page.writesWithoutSending("First line");
    await app.page.pressesEnterInTheMessageBox();

    // ********************************************************************
    // ** THEN the box holds the line and a new line, and nothing was sent
    // ********************************************************************
    await expectMessageBoxToHold(app, "First line\n");
    await expectStreamNotToShow(app, "First line");
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
    await opensSessionThatAnswersTwice(app);

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
