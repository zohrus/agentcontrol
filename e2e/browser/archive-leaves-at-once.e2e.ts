import { RelayName } from "@agentcontrol/protocol";
import { afterEach, test } from "bun:test";
import { basename } from "node:path";
import { expectSessionUnderArchived } from "../support/browser/browser-expectations.ts";
import { expectHeaderToShow } from "../support/browser/header-expectations.ts";
import {
  expectListedSessions,
  expectPageToShow,
  expectToastToShow,
} from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayThatIsSlowToAnswer } from "../support/setup/slow-relay.ts";

afterEach(cleanUpAfterTest);

/** An app whose relay does not archive until the test lets it, with a session open in the browser. */
async function aSessionOpenBehindARelaySlowToArchive() {
  const relay = aRelayThatIsSlowToAnswer(RelayName.sessionsArchive);
  const app = await startAppInBrowser({ relayWire: relay.wire });
  app.mockAgent.willReply("Nothing to change");
  const session = await app.user.startsSession({ prompt: "Check the readme" });
  await app.page.opensSession(session.title);
  return { app, relay, session };
}

test(
  "an archived session leaves the list at once and the view moves on to the next session",
  async () => {
    // ********************************************************************
    // ** GIVEN two sessions, the first open, and a relay that is slow to archive
    // ********************************************************************
    const { app, relay, session } = await aSessionOpenBehindARelaySlowToArchive();
    const other = await app.user.startsSession({ prompt: "Review the tests" });
    await expectListedSessions(app, [other.title, session.title]);
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user archives the open session and confirms, and the relay has not answered
    // ********************************************************************
    await app.page.archives();

    // ********************************************************************
    // ** THEN the list shows only the other session, and the view shows it
    // ********************************************************************
    await expectListedSessions(app, [other.title]);
    await expectHeaderToShow(app, other.title);
    // AND once the relay has archived it, it is under Archived
    relay.answers();
    await expectSessionUnderArchived(app, session.title);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "archiving the only session leaves the list empty and no session open, at once",
  async () => {
    // ********************************************************************
    // ** GIVEN one session open in the browser, and a relay that is slow to archive
    // ********************************************************************
    const { app, relay } = await aSessionOpenBehindARelaySlowToArchive();

    // ********************************************************************
    // ** WHEN the user archives it and confirms, and the relay has not answered
    // ********************************************************************
    await app.page.archives();

    // ********************************************************************
    // ** THEN the list is empty and no session is open
    // ********************************************************************
    await expectListedSessions(app, []);
    await expectPageToShow(app, "Open a session to see its changes.");
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an archive that fails brings the session back, with a message that says which and why",
  async () => {
    // ********************************************************************
    // ** GIVEN a session being archived: gone from the list while the relay has not answered
    // ********************************************************************
    const { app, relay, session } = await aSessionOpenBehindARelaySlowToArchive();
    await app.page.archives();
    await expectListedSessions(app, []);

    // ********************************************************************
    // ** WHEN the relay refuses to archive it
    // ********************************************************************
    relay.refuses("the disk is full");

    // ********************************************************************
    // ** THEN the session is in the list again, and a message names it
    // ********************************************************************
    await expectListedSessions(app, [session.title]);
    await expectToastToShow(app, `Could not archive "${session.title}"`);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a session being archived does not come back when the list is refreshed",
  async () => {
    // ********************************************************************
    // ** GIVEN a session being archived: gone from the list while the relay has not answered
    // ********************************************************************
    const { app, relay } = await aSessionOpenBehindARelaySlowToArchive();
    await app.page.archives();
    await expectListedSessions(app, []);

    // ********************************************************************
    // ** WHEN the user starts another session, which makes the page read the whole list again
    // ********************************************************************
    await app.page.createsSession({ agent: "Mock agent", repoPath: app.repoPath });

    // ********************************************************************
    // ** THEN the list shows the new session only
    // ********************************************************************
    await expectPageToShow(app, "new session");
    await expectListedSessions(app, [`${basename(app.repoPath)} – new session`]);
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);
