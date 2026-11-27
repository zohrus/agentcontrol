import { RelayName } from "@agentcontrol/protocol";
import { afterEach, test } from "bun:test";
import {
  expectSessionListed,
  expectSessionUnderArchived,
  expectStreamToShow,
} from "../support/browser/browser-expectations.ts";
import {
  expectDialogToShow,
  expectListedSessions,
  expectPageToShow,
  expectToastToShow,
} from "../support/browser/page-expectations.ts";
import { aSessionAskingPermissionBehindARelaySlowToAnswer } from "../support/browser/ready-session-setups.ts";
import { opensSessionWithUncommittedEdit } from "../support/browser/open-session-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayThatIsSlowToAnswer } from "../support/setup/slow-relay.ts";

afterEach(cleanUpAfterTest);

test(
  "a session the app refuses is open at once, then leaves the list again with the reason",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, and a relay that is slow to create sessions
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.sessionsCreate);
    const app = await startAppInBrowser({ relayWire: relay.wire });

    // ********************************************************************
    // ** WHEN the user creates a session from a base branch that does not exist
    // ********************************************************************
    await app.page.createsSession({
      agent: "Mock agent",
      repoPath: app.repoPath,
      baseBranch: "no-such-branch",
    });
    // AND the session is listed and open while the relay has not answered
    await expectPageToShow(app, "new session", "starting");
    await app.page.messageBoxText();

    // ********************************************************************
    // ** THEN once the relay refuses it, a message says why
    // ********************************************************************
    relay.answers();
    await expectToastToShow(app, "invalid reference: no-such-branch");
    // AND the session is gone from the list, and the user is not left on it
    await expectListedSessions(app, []);
    await expectPageToShow(app, "No sessions yet");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "archiving a session with unsaved changes removes it, then brings it back and asks again",
  async () => {
    // ********************************************************************
    // ** GIVEN a session with an uncommitted edit, open in a browser, and a relay slow to archive
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.sessionsArchive);
    const app = await startAppInBrowser({ relayWire: relay.wire });
    const session = await opensSessionWithUncommittedEdit(app, "Reword the readme");
    await expectSessionListed(app, session.title);

    // ********************************************************************
    // ** WHEN the user archives it and confirms
    // ********************************************************************
    await app.page.archives();
    // AND the session is gone from the list while the relay has not answered
    await expectListedSessions(app, []);
    relay.answers();

    // ********************************************************************
    // ** THEN the session is back and the dialog asks again, listing the unsaved file
    // ********************************************************************
    await expectDialogToShow(app, "README.md", "Archive anyway");
    await expectListedSessions(app, [session.title]);
    // AND Archive anyway archives it
    await app.page.archivesAnyway();
    await expectSessionUnderArchived(app, session.title);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an answer to a permission request is shown as sending, then as answered when the agent has it",
  async () => {
    // ********************************************************************
    // ** GIVEN a session waiting for permission to run `npm test`, and a relay slow to take answers
    // ********************************************************************
    const { app, relay } = await aSessionAskingPermissionBehindARelaySlowToAnswer("All tests pass");

    // ********************************************************************
    // ** WHEN the user allows the command
    // ********************************************************************
    await app.page.allowsTheCommandInTheStream();
    // AND the request says the answer is on its way, with no button left to press twice
    await expectPageToShow(app, "Sending “Allow” to the agent");
    // AND the relay takes the answer
    relay.answers();

    // ********************************************************************
    // ** THEN the agent finishes and the request shows the answer it was given
    // ********************************************************************
    await expectStreamToShow(app, "All tests pass");
    await expectPageToShow(app, "Answered:");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
