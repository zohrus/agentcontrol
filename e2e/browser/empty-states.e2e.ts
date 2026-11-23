import { afterEach, test } from "bun:test";
import { expectDialogToShow, expectPageToShow } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a new user is welcomed and guided to add a first repository",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, with no repository and no session
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the user looks at the page
    // ********************************************************************
    await expectPageToShow(app, "Welcome to AgentControl", "Open a session to see its changes.");

    // ********************************************************************
    // ** THEN the guide's button leads to the dialog where a repository is added
    // ********************************************************************
    await app.page.choosesToAddARepositoryFromTheGuide();
    await expectDialogToShow(app, "New session", "Add repository…");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "once a repository is known the empty page offers to start the first session",
  async () => {
    // ********************************************************************
    // ** GIVEN a repository the app knows, and no session yet
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.user.addsTheRepo();

    // ********************************************************************
    // ** WHEN the user opens the page again
    // ********************************************************************
    await app.page.reloads();

    // ********************************************************************
    // ** THEN the page offers to start the first session, which opens the New session dialog
    // ********************************************************************
    await expectPageToShow(app, "No sessions yet");
    await app.page.choosesToStartTheFirstSession();
    await expectDialogToShow(app, "New session", app.repoPath);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an address that names no session leaves the page working and says so",
  async () => {
    // ********************************************************************
    // ** GIVEN a session exists and the app is open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.user.startsSession({ prompt: "Add rate limiting" });
    await app.page.reloads();
    await expectPageToShow(app, "Select a session to see what its agent is doing.");

    // ********************************************************************
    // ** WHEN the user types an address that cannot be read, then one of a session that is gone
    // ********************************************************************
    await app.page.goesToAddress("#/sessions/%E0%A4%A");
    await expectPageToShow(app, "Select a session to see what its agent is doing.");
    await app.page.goesToAddress(`#/sessions/${crypto.randomUUID()}`);

    // ********************************************************************
    // ** THEN the page says that session no longer exists
    // ********************************************************************
    await expectPageToShow(app, "That session no longer exists.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
