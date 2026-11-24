import { RelayName } from "@agentcontrol/protocol";
import { afterEach, test } from "bun:test";
import { pageShows } from "../support/browser/reaction.ts";
import { expectPageToReactAtOnce } from "../support/browser/reaction-expectations.ts";
import {
  aReadySessionOpenInTheBrowser,
  aSessionAskingPermissionBehindARelaySlowToAnswer,
} from "../support/browser/ready-session-setups.ts";
import { opensSessionWhoseRelayThenRestarts } from "../support/browser/resume-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { expectSessionToBe } from "../support/expect/ready-session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayThatIsSlowToAnswer } from "../support/setup/slow-relay.ts";

afterEach(cleanUpAfterTest);

test(
  "a message the user sends is in the conversation at once, while the relay has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN a ready session open in a browser, and a relay that is slow to take messages
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.prompt);
    const app = await startAppInBrowser({ relayWire: relay.wire });
    await aReadySessionOpenInTheBrowser(app);

    // ********************************************************************
    // ** WHEN the user sends "Add rate limiting"
    // ********************************************************************
    // ********************************************************************
    // ** THEN the message is in the conversation before the relay has it
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Send message",
      act: () => app.page.sendsMessage("Add rate limiting"),
      shown: `document.querySelector('[role="log"]')?.innerText.includes("Add rate limiting")`,
      reads: "show the message in the conversation",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "answering a permission request shows the answer being sent at once, while the relay has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN a session waiting for permission to run `npm test`, and a slow relay
    // ********************************************************************
    const { app, relay } = await aSessionAskingPermissionBehindARelaySlowToAnswer("All tests pass");

    // ********************************************************************
    // ** WHEN the user allows the command
    // ********************************************************************
    // ********************************************************************
    // ** THEN the request shows that the answer is on its way
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Allow",
      act: () => app.page.allowsTheCommandInTheStream(),
      shown: pageShows("Sending"),
      reads: "say that the answer is being sent",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "cancelling a turn shows it is being cancelled at once, while the relay has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent is in the middle of a turn, and a slow relay
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.cancel);
    const app = await startAppInBrowser({ relayWire: relay.wire });
    app.mockAgent.willWaitUntilCancelled();
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await expectSessionToBe(app, { session, status: "running" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user cancels the turn
    // ********************************************************************
    // ********************************************************************
    // ** THEN the page says the turn is being cancelled
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Cancel",
      act: () => app.page.cancelsTheTurn(),
      shown: pageShows("Cancelling"),
      reads: "say that the turn is being cancelled",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "archiving a session shows it is being archived at once, while the relay has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN a ready session open in a browser, and a slow relay
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.sessionsArchive);
    const app = await startAppInBrowser({ relayWire: relay.wire });
    await aReadySessionOpenInTheBrowser(app);
    await app.page.asksToArchive();

    // ********************************************************************
    // ** WHEN the user confirms archiving it
    // ********************************************************************
    // ********************************************************************
    // ** THEN the page says the session is being archived
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Archive (confirm)",
      act: () => app.page.confirmsTheArchive(),
      shown: pageShows("Archiving"),
      reads: "say that the session is being archived",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "resuming an interrupted session shows it is being resumed at once, while the relay has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN a session the relay's restart interrupted, open in a browser, and a slow relay
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.sessionsResume);
    const app = await startAppInBrowser({ relayWire: relay.wire });
    const session = await opensSessionWhoseRelayThenRestarts(app);
    await expectSessionToBe(app, { session, status: "interrupted" });

    // ********************************************************************
    // ** WHEN the user presses Resume
    // ********************************************************************
    // ********************************************************************
    // ** THEN the page says the session is being resumed
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Resume",
      act: () => app.page.resumes(),
      shown: pageShows("Resuming"),
      reads: "say that the session is being resumed",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);
