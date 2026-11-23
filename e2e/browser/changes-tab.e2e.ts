import { afterEach, test } from "bun:test";
import {
  expectChangesTabToList,
  expectDiffToShow,
} from "../support/browser/browser-expectations.ts";
import {
  expectEditableFiles,
  expectVscodeLinkToEndWith,
} from "../support/browser/changes-expectations.ts";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { opensSessionWithEditedAndNewFile } from "../support/browser/more-session-setups.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a file the agent created is listed next to the one it edited and shows as all added",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md and created NOTES.md, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionWithEditedAndNewFile(app);

    // ********************************************************************
    // ** WHEN the user picks the new file in the Changes tab
    // ********************************************************************
    await expectChangesTabToList(app, "NOTES.md");
    await app.page.opensChangedFile("NOTES.md");

    // ********************************************************************
    // ** THEN the diff shows its content, which has no earlier version to compare with
    // ********************************************************************
    await expectDiffToShow(app, "// after");
    // AND the other file is still listed
    await expectChangesTabToList(app, "README.md");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the Editor tab narrows its files by name and links to the file in VS Code",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md and created NOTES.md, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionWithEditedAndNewFile(app);
    await app.page.opensEditorTab();

    // ********************************************************************
    // ** WHEN the user types "notes" into the file filter and opens the file
    // ********************************************************************
    await app.page.filtersFilesBy("notes");
    await app.page.opensFileInEditor("NOTES.md");

    // ********************************************************************
    // ** THEN only NOTES.md is offered
    // ********************************************************************
    await expectEditableFiles(app, ["NOTES.md"]);
    // AND "Open in VS Code" leads to that file
    await expectVscodeLinkToEndWith(app, "NOTES.md");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "while the agent is still working the editor is read-only and says so",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md and keeps working
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willEditFile("README.md");
    app.mockAgent.willWaitUntilCancelled();
    const session = await app.user.startsSession({ prompt: "Keep going" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** WHEN the user opens the file in the Editor tab
    // ********************************************************************
    await app.page.opensEditorTab();
    await app.page.opensFileInEditor("README.md");

    // ********************************************************************
    // ** THEN the editor says it is read-only while the agent runs
    // ********************************************************************
    await expectPageToShow(app, "read-only while the agent runs");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
