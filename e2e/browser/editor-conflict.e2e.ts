import { afterEach, test } from "bun:test";
import { expectEditorToShow } from "../support/browser/browser-expectations.ts";
import { opensSessionWithUncommittedEdit } from "../support/browser/open-session-setups.ts";
import { expectEditorNoticeToSay } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "saving a file that changed on disk meanwhile is refused and the newer version is shown with a note",
  async () => {
    // ********************************************************************
    // ** GIVEN README.md open in the editor, and the page not yet told about newer file contents
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await opensSessionWithUncommittedEdit(app, "Reword the readme");
    await app.page.opensEditorTab();
    await app.page.opensFileInEditor("README.md");
    await expectEditorToShow(app, "// after");
    const letsFilesArrive = await app.page.holdsBackFileContents();

    // ********************************************************************
    // ** WHEN another program changes README.md and the user saves their own edit
    // ********************************************************************
    await app.user.editsAFileInTheWorktree(session, "README.md");
    await app.page.replacesFileAndSaves("my edit");
    letsFilesArrive();

    // ********************************************************************
    // ** THEN a note says the file changed on disk and the editor shows the newer version
    // ********************************************************************
    await expectEditorNoticeToSay(app, "changed on disk");
    await expectEditorToShow(app, "edited outside the app");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
