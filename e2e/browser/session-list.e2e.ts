import { afterEach, test } from "bun:test";
import {
  expectSessionRowToOfferNoApproval,
  expectStreamToShow,
} from "../support/browser/browser-expectations.ts";
import {
  expectAddressToOpen,
  expectListedSessions,
  expectPageToShow,
} from "../support/browser/page-expectations.ts";
import { walksDownUpAndDownTheList } from "../support/browser/list-walks.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import {
  expectSessionWaitingForApproval,
  expectSessionWaitingForReply,
} from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the Inbox lists only the sessions waiting on the user, and All lists every session",
  async () => {
    // ********************************************************************
    // ** GIVEN one session waiting for approval and one whose agent is still working
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willAskToRunCommand("npm test");
    const waiting = await app.user.startsSession({ prompt: "Add rate limiting" });
    await expectSessionWaitingForApproval(app, waiting);
    app.mockAgent.startsNewScript();
    app.mockAgent.willWaitUntilCancelled();
    await app.user.startsSession({ prompt: "Refactor the parser" });

    // ********************************************************************
    // ** WHEN the user looks at the Inbox
    // ********************************************************************
    await app.page.showsTheInbox();

    // ********************************************************************
    // ** THEN the list shows only the session that waits, and the Inbox counts it
    // ********************************************************************
    await expectListedSessions(app, ["Add rate limiting"]);
    await expectPageToShow(app, "Inbox (1)");
    // AND All shows both, the waiting one first
    await app.page.showsAllSessions();
    await expectListedSessions(app, ["Add rate limiting", "Refactor the parser"]);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "j and k move through the session list and Enter opens the session in focus",
  async () => {
    // ********************************************************************
    // ** GIVEN two sessions in the list, both waiting for a reply
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReply("Done");
    const first = await app.user.startsSession({ prompt: "First task" });
    const second = await app.user.startsSession({ prompt: "Second task" });
    await expectSessionWaitingForReply(app, first);
    await expectSessionWaitingForReply(app, second);
    // AND the newest session is listed on top
    await expectListedSessions(app, ["Second task", "First task"]);

    // ********************************************************************
    // ** WHEN the user focuses the top row, presses j, k, j and then Enter
    // ********************************************************************
    await walksDownUpAndDownTheList(app, { top: "Second task", below: "First task" });
    await app.page.pressesKey("Enter");

    // ********************************************************************
    // ** THEN the first session is open
    // ********************************************************************
    await expectAddressToOpen(app, first.id);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "approving from the session's row lets the agent carry on",
  async () => {
    // ********************************************************************
    // ** GIVEN a session waiting for approval to run `npm test`, then replying "All tests pass"
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willAskToRunCommand("npm test");
    app.mockAgent.willReply("All tests pass");
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await expectSessionWaitingForApproval(app, session);
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user presses Approve on the session's row
    // ********************************************************************
    await app.page.approvesFromTheRow(session.title);

    // ********************************************************************
    // ** THEN the agent's reply appears and the row offers no approval any more
    // ********************************************************************
    await expectStreamToShow(app, "All tests pass");
    await expectSessionRowToOfferNoApproval(app, session.title);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "denying from the session's row stops the command and ends the turn",
  async () => {
    // ********************************************************************
    // ** GIVEN a session waiting for approval to run `npm test`, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willAskToRunCommand("npm test");
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await expectSessionWaitingForApproval(app, session);
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user presses Deny on the session's row
    // ********************************************************************
    await app.page.deniesFromTheRow(session.title);

    // ********************************************************************
    // ** THEN the conversation shows the request was answered and the turn ended
    // ********************************************************************
    await expectStreamToShow(app, "Answered: Reject");
    await expectStreamToShow(app, "Turn ended");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
