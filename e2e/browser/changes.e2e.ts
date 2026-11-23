import { afterEach, test } from "bun:test";
import {
  expectChangesTabToList,
  expectDiffToShow,
  expectFileToBeSaved,
} from "../support/browser/browser-expectations.ts";
import { opensReadmeInTheEditor } from "../support/browser/more-session-setups.ts";
import { opensSessionWithUncommittedEdit } from "../support/browser/open-session-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the Changes tab lists the file the agent edited and shows its diff",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md and finished its turn, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionWithUncommittedEdit(app, "Reword the readme");

    // ********************************************************************
    // ** WHEN the user looks at the Changes tab
    // ********************************************************************
    await app.page.opensChangesTab();

    // ********************************************************************
    // ** THEN the Changes tab lists README.md
    // ********************************************************************
    await expectChangesTabToList(app, "README.md");
    // AND the diff shows the new line the agent wrote
    await expectDiffToShow(app, "// after");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a file edited in the browser's editor and saved is written to the session's worktree",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent finished its turn after editing README.md, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await opensReadmeInTheEditor(app);

    // ********************************************************************
    // ** WHEN the user replaces the text and saves
    // ********************************************************************
    await app.page.replacesFileAndSaves("edited by the user");

    // ********************************************************************
    // ** THEN the file in the worktree holds the new text
    // ********************************************************************
    await expectFileToBeSaved(app, { session, path: "README.md", content: "edited by the user" });
    // AND the page has taken the save in: the Changes tab shows the new text
    await app.page.opensChangesTab();
    await expectDiffToShow(app, "edited by the user");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
