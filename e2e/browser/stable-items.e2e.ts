import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import {
  aReadySessionBehindARelaySlowToTakeMessages,
  aSessionAskingPermissionBehindARelaySlowToAnswer,
} from "../support/browser/ready-session-setups.ts";
import {
  expectCardKeptItsPlaceAndSize,
  expectCardToStillShow,
  expectItemKeptItsElementPlaceAndSize,
  expectSameElementAfterSecondRead,
  expectSameElementInTheSamePlace,
  theMarkedItem,
} from "../support/browser/stable-stream-expectations.ts";
import {
  theAgentWaitsForTheTest,
  theCardMarkedAs,
} from "../support/browser/stable-stream-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the card of a first lookup is the same element when a second lookup joins it",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that reads one file, waits, then reads another, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReadFile("README.md");
    const hold = theAgentWaitsForTheTest(app);
    app.mockAgent.willReadFile("package.json");
    const session = await app.user.startsSession({ prompt: "Look around" });
    await app.page.opensSession(session.title);
    await expectStreamToShow(app, "Read 1 file");
    await app.page.marksTheItemWith("Read 1 file", "lookups");
    const before = await theMarkedItem(app, "lookups");

    // ********************************************************************
    // ** WHEN the agent reads the second file
    // ********************************************************************
    await hold.letsTheAgentGoOn();

    // ********************************************************************
    // ** THEN the very same card now says it read 2 files
    // ********************************************************************
    await expectSameElementAfterSecondRead(app, { mark: "lookups", says: "Read 2 files" });
    // AND it is still in the same place
    await expectSameElementInTheSamePlace(app, {
      mark: "lookups",
      what: "the lookups card",
      before,
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a sent message is the same element, as tall as before, when the conversation holds its own copy",
  async () => {
    // ********************************************************************
    // ** GIVEN a message the user sent that the relay has not taken yet
    // ********************************************************************
    const { app, relay } = await aReadySessionBehindARelaySlowToTakeMessages("In place");
    await app.page.sendsMessage("Add rate limiting");
    await expectPageToShow(app, "Sending…");
    await app.page.marksTheItemWith("Add rate limiting", "message");
    const before = await theMarkedItem(app, "message");

    // ********************************************************************
    // ** WHEN the relay takes it and the agent replies
    // ********************************************************************
    relay.answers();
    await expectStreamToShow(app, "In place");

    // ********************************************************************
    // ** THEN the message is the element that was there, at the same place and height
    // ********************************************************************
    await expectItemKeptItsElementPlaceAndSize(app, {
      mark: "message",
      what: "the sent message",
      before,
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a permission card keeps the command and its place and size after the user allows it",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that asks to run `npm test`, and the card shown in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willAskToRunCommand("npm test");
    app.mockAgent.willReply("All tests pass");
    const session = await app.user.startsSession({ prompt: "Run the tests" });
    await app.page.opensSession(session.title);
    const before = await theCardMarkedAs(app, "card");

    // ********************************************************************
    // ** WHEN the user allows the command
    // ********************************************************************
    await app.page.allowsTheCommandInTheStream();
    await expectStreamToShow(app, "All tests pass");

    // ********************************************************************
    // ** THEN the card still shows the command, says it was answered, and is where it was
    // ********************************************************************
    await expectCardToStillShow(app, { mark: "card", text: "$ npm test" });
    await expectCardToStillShow(app, { mark: "card", text: "Answered: Allow" });
    await expectCardKeptItsPlaceAndSize(app, {
      mark: "card",
      before,
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a permission card keeps the changes it showed after the user allows them",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that asks to write a file, and the card with the changes shown
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willWriteFile("notes.txt", "a line only the diff shows\n");
    app.mockAgent.willReply("Written");
    const session = await app.user.startsSession({ prompt: "Write the notes" });
    await app.page.opensSession(session.title);
    await expectStreamToShow(app, "a line only the diff shows");
    const before = await theCardMarkedAs(app, "card");

    // ********************************************************************
    // ** WHEN the user allows the change
    // ********************************************************************
    await app.page.allowsTheCommandInTheStream();
    await expectStreamToShow(app, "Written");

    // ********************************************************************
    // ** THEN the card still shows the changes, and is where it was, at least as tall
    // ********************************************************************
    await expectCardToStillShow(app, { mark: "card", text: "a line only the diff shows" });
    await expectCardKeptItsPlaceAndSize(app, {
      mark: "card",
      before,
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a permission card keeps its place and size while its answer is on the way and when it arrives",
  async () => {
    // ********************************************************************
    // ** GIVEN a card asking to run `npm test`, behind a relay slow to take the answer
    // ********************************************************************
    const { app, relay } = await aSessionAskingPermissionBehindARelaySlowToAnswer("All tests pass");
    const before = await theCardMarkedAs(app, "card");
    const same = { mark: "card", before };

    // ********************************************************************
    // ** WHEN the user allows the command, while the relay has not taken the answer
    // ********************************************************************
    await app.page.allowsTheCommandInTheStream();
    await expectPageToShow(app, "Sending “Allow” to the agent");

    // ********************************************************************
    // ** THEN the card is where it was and as tall
    // ********************************************************************
    await expectCardKeptItsPlaceAndSize(app, same);
    // AND once the relay takes the answer, it still is
    relay.answers();
    await expectStreamToShow(app, "All tests pass");
    await expectCardToStillShow(app, { mark: "card", text: "Answered: Allow" });
    await expectCardKeptItsPlaceAndSize(app, same);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
