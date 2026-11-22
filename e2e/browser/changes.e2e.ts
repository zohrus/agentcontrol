import { afterEach, test } from "bun:test";
import {
  expectChangesTabToList,
  expectDiffToShow,
  expectEditorToShow,
  expectFileToBeSaved,
} from "../support/browser/browser-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the Changes tab lists the file the agent edited and shows its diff",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md and finished its turn
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willEditFile("README.md");
    const session = await app.user.startsSession({ prompt: "Reword the readme" });
    await expectSessionWaitingForReply(app, session);

    // ********************************************************************
    // ** WHEN the user opens the session in the browser
    // ********************************************************************
    await app.page.opensSession(session.title);

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
    // ** GIVEN a session whose agent finished its turn after editing README.md
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willEditFile("README.md");
    const session = await app.user.startsSession({ prompt: "Reword the readme" });
    await expectSessionWaitingForReply(app, session);
    // AND the user has opened README.md in the editor
    await app.page.opensSession(session.title);
    await app.page.opensEditorTab();
    await app.page.opensFileInEditor("README.md");
    await expectEditorToShow(app, "// after");

    // ********************************************************************
    // ** WHEN the user replaces the text and saves
    // ********************************************************************
    await app.page.replacesFileAndSaves("edited by the user");

    // ********************************************************************
    // ** THEN the file in the worktree holds the new text
    // ********************************************************************
    await expectFileToBeSaved(app, { session, path: "README.md", content: "edited by the user" });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
