import { afterEach, test } from "bun:test";
import {
  expectSessionRowToOfferNoApproval,
  expectSessionRowToShowApproveBadge,
  expectStreamToShow,
} from "../support/browser/browser-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { expectSessionWaitingForApproval } from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the session list flags a session that waits for approval with an approve badge",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();
    // AND the agent will ask permission to run `npm test` on its first turn
    app.mockAgent.willAskToRunCommand("npm test");

    // ********************************************************************
    // ** WHEN the user starts a session asking to add rate limiting
    // ********************************************************************
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await expectSessionWaitingForApproval(app, session);

    // ********************************************************************
    // ** THEN the session's row in the list shows an approve badge
    // ********************************************************************
    await expectSessionRowToShowApproveBadge(app, session.title);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "allowing the command in the browser lets the agent finish and its reply appears without a reload",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent asks to run `npm test` before it replies "All tests pass"
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willAskToRunCommand("npm test");
    app.mockAgent.willReply("All tests pass");
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    // AND the user has opened the session in the browser
    await expectSessionRowToShowApproveBadge(app, session.title);
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user allows the command in the conversation
    // ********************************************************************
    await app.page.allowsTheCommandInTheStream();

    // ********************************************************************
    // ** THEN the agent's reply appears in the conversation
    // ********************************************************************
    await expectStreamToShow(app, "All tests pass");
    // AND the row no longer offers an approval
    await expectSessionRowToOfferNoApproval(app, session.title);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
