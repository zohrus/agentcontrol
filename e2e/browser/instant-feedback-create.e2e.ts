import { afterEach, test } from "bun:test";
import {
  A_SESSION_IS_OPEN_WITH_ITS_MESSAGE_BOX,
  aFilledInNewSessionDialog,
} from "../support/browser/new-session-setups.ts";
import { expectEditableFiles } from "../support/browser/changes-expectations.ts";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import { expectPageToReactAtOnce } from "../support/browser/reaction-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { givesTheRepoARemoteThatHangs } from "../support/setup/hung-remote.ts";
import { theRepoSetupWaitsForTheTest } from "../support/setup/slow-setup.ts";

afterEach(cleanUpAfterTest);

test(
  "a new session is open with its message box at once, while the remote has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN the repository's remote hangs and its setup script is slow
    // ********************************************************************
    const app = await startAppInBrowser();
    const remote = await givesTheRepoARemoteThatHangs(app.repoPath);
    const setup = await theRepoSetupWaitsForTheTest(app);
    await aFilledInNewSessionDialog(app);

    // ********************************************************************
    // ** WHEN the user presses Create session in the filled-in dialog
    // ********************************************************************
    // ********************************************************************
    // ** THEN the session is listed and open with its message box, before the remote answers
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Create session",
      act: () => app.page.createsTheSession(),
      shown: A_SESSION_IS_OPEN_WITH_ITS_MESSAGE_BOX,
      reads: "list the new session and open it with its message box",
      backEndAnswers: () => remote.answers(),
    });
    // AND once the remote answers and the setup ends, the session is ready and says where it began
    await remote.answers();
    await setup.finishes();
    await expectPageToShow(app, "ready", "Worktree setup finished");
    await app.page.opensTheSetupOutput();
    await expectPageToShow(app, "Started from the latest origin/main");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the Editor tab of a new session lists its files once the worktree is made",
  async () => {
    // ********************************************************************
    // ** GIVEN a session just created while the remote hangs, with its Editor tab open and empty
    // ********************************************************************
    const app = await startAppInBrowser();
    const remote = await givesTheRepoARemoteThatHangs(app.repoPath);
    await aFilledInNewSessionDialog(app);
    await app.page.createsTheSession();
    await app.page.opensEditorTab();

    // ********************************************************************
    // ** WHEN the remote answers and the worktree is made
    // ********************************************************************
    await remote.answers();

    // ********************************************************************
    // ** THEN the Editor tab lists the repository's files without being reopened
    // ********************************************************************
    await expectEditableFiles(app, [".gitignore", "README.md"]);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
