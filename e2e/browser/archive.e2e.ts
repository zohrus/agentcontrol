import { afterEach, test } from "bun:test";
import {
  expectArchiveWarningToList,
  expectSessionUnderArchived,
} from "../support/browser/browser-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { opensSessionWithUncommittedEdit } from "../support/browser/open-session-setups.ts";
import { expectSessionArchived } from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "archiving a session with uncommitted changes warns and lists the changed file",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md without committing, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionWithUncommittedEdit(app, "Reword the readme");

    // ********************************************************************
    // ** WHEN the user archives the session
    // ********************************************************************
    await app.page.archives();

    // ********************************************************************
    // ** THEN the warning lists README.md as a change that would be lost
    // ********************************************************************
    await expectArchiveWarningToList(app, ["README.md"]);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Archive anyway moves the session to the Archived list",
  async () => {
    // ********************************************************************
    // ** GIVEN the archive warning is showing for a session with an uncommitted edit
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await opensSessionWithUncommittedEdit(app, "Reword the readme");
    await app.page.archives();
    await expectArchiveWarningToList(app, ["README.md"]);

    // ********************************************************************
    // ** WHEN the user chooses Archive anyway
    // ********************************************************************
    await app.page.archivesAnyway();

    // ********************************************************************
    // ** THEN the session is archived and listed under Archived
    // ********************************************************************
    await expectSessionArchived(app, session);
    await expectSessionUnderArchived(app, session.title);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
