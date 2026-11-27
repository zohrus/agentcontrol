import { afterEach, test } from "bun:test";
import { expectMessageBoxToHold } from "../support/browser/message-box-expectations.ts";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import {
  expectAgentToHaveBeenSent,
  expectConversationToShowInOrder,
  expectQueueToHold,
} from "../support/browser/queue-expectations.ts";
import {
  aBusySessionWithQueuedMessages,
  aSessionWhoseAgentIsBusy,
} from "../support/browser/queue-setups.ts";
import { expectStreamNotToShow } from "../support/browser/rendering-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a message sent while the agent is busy waits in the queue above the box, not in the conversation",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in the browser whose agent is in the middle of a turn
    // ********************************************************************
    const app = await startAppInBrowser();
    await aSessionWhoseAgentIsBusy(app);

    // ********************************************************************
    // ** WHEN the user sends another message
    // ********************************************************************
    await app.page.sendsMessage("Also add tests");

    // ********************************************************************
    // ** THEN the message is in the queue, the box is empty again, and the agent has not got it
    // ********************************************************************
    await expectQueueToHold(app, "Also add tests");
    await expectMessageBoxToHold(app, "");
    await expectStreamNotToShow(app, "Also add tests");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a queued message is sent when the turn ends",
  async () => {
    // ********************************************************************
    // ** GIVEN a busy session with one message waiting in the queue
    // ********************************************************************
    const app = await startAppInBrowser();
    const { turns } = await aBusySessionWithQueuedMessages(app, "Also add tests");

    // ********************************************************************
    // ** WHEN the agent finishes its turn
    // ********************************************************************
    await turns.first.letsTheAgentGoOn();

    // ********************************************************************
    // ** THEN the queued message is in the conversation, the agent answers it, and the queue is empty
    // ********************************************************************
    await expectStreamToShowAll(app, "Also add tests", "Answer two");
    await expectQueueToHold(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "queued messages are sent one per turn, in the order they were written",
  async () => {
    // ********************************************************************
    // ** GIVEN a busy session with two messages waiting in the queue
    // ********************************************************************
    const app = await startAppInBrowser();
    const { turns } = await aBusySessionWithQueuedMessages(app, "Second request", "Third request");
    await expectQueueToHold(app, "Second request", "Third request");

    // ********************************************************************
    // ** WHEN the agent finishes its first turn
    // ********************************************************************
    await turns.first.letsTheAgentGoOn();

    // ********************************************************************
    // ** THEN only the first queued message is sent, and the second keeps waiting
    // ********************************************************************
    await expectStreamToShowAll(app, "Second request", "Answer two");
    await expectQueueToHold(app, "Third request");
    await expectStreamNotToShow(app, "Third request");
    // AND when the second turn ends, the second queued message is sent after it
    await turns.second.letsTheAgentGoOn();
    await expectConversationToShowInOrder(
      app,
      "Second request",
      "Answer two",
      "Third request",
      "Answer three",
    );
    await expectQueueToHold(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a queued message is sent when the turn ends even while another session is on screen",
  async () => {
    // ********************************************************************
    // ** GIVEN a busy session with a queued message, and the user looking at another session
    // ********************************************************************
    const app = await startAppInBrowser();
    const { session, turns } = await aBusySessionWithQueuedMessages(app, "Also add tests");
    await app.page.createsSession({ agent: "Mock agent", repoPath: app.repoPath });

    // ********************************************************************
    // ** WHEN the first session's agent finishes its turn
    // ********************************************************************
    await turns.first.letsTheAgentGoOn();

    // ********************************************************************
    // ** THEN the agent of the first session is sent the queued message, which is not queued any more
    // ********************************************************************
    await expectAgentToHaveBeenSent(app, { session, text: "Also add tests" });
    // AND back in that session the conversation shows it
    await app.page.opensSession(session.title);
    await expectStreamToShowAll(app, "Also add tests", "Answer two");
    await expectQueueToHold(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Remove drops a queued message, which is then never sent",
  async () => {
    // ********************************************************************
    // ** GIVEN a busy session with two messages waiting in the queue
    // ********************************************************************
    const app = await startAppInBrowser();
    const { turns } = await aBusySessionWithQueuedMessages(app, "Second request", "Third request");

    // ********************************************************************
    // ** WHEN the user removes the first queued message and the agent finishes its turn
    // ********************************************************************
    await app.page.removesTheQueuedMessage("Second request");
    await expectQueueToHold(app, "Third request");
    await turns.first.letsTheAgentGoOn();

    // ********************************************************************
    // ** THEN the message that was left is sent, and the removed one is not in the conversation
    // ********************************************************************
    await expectStreamToShowAll(app, "Third request", "Answer two");
    await expectStreamNotToShow(app, "Second request");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
