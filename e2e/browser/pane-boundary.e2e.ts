import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { expectReloadedPanelToListChangedFile } from "../support/browser/changes-expectations.ts";
import { startsSessionWithUnreadableChanges } from "../support/browser/open-session-setups.ts";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a panel that crashes is replaced by a note and can be reloaded, while the rest of the page works",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose changes the page gets in a shape it cannot show
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await startsSessionWithUnreadableChanges(app);

    // ********************************************************************
    // ** WHEN the user opens the session
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the changes panel is replaced by a note that it stopped working
    // ********************************************************************
    await expectPageToShow(app, "The “changes” panel stopped working.");
    // AND the conversation next to it still works
    await expectStreamToShow(app, "Reworded");

    // ********************************************************************
    // ** WHEN the changes arrive in a good shape
    // ********************************************************************
    await app.page.getsRealAnswersAgain();
    await app.user.editsAFileInTheWorktree(session, "README.md");

    // ********************************************************************
    // ** THEN reloading the panel brings the Changes tab back, listing the changed file
    // ********************************************************************
    await expectReloadedPanelToListChangedFile(app, "README.md");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
