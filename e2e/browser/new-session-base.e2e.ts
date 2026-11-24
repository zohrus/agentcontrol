import { afterEach, test } from "bun:test";
import { expectDialogToShow, expectPageToShow } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { givesTheRepoARemote } from "../support/setup/repo-remote.ts";

afterEach(cleanUpAfterTest);

test(
  "the New session dialog starts a session from the latest remote trunk without the branch field being touched",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser, on a repository that has a remote
    // ********************************************************************
    const app = await startAppInBrowser();
    await givesTheRepoARemote(app.repoPath);

    // ********************************************************************
    // ** WHEN the user starts a session from the dialog and leaves the branch field alone
    // ********************************************************************
    const mock = { repoPath: app.repoPath, agent: "Mock agent", prompt: "Add rate limiting" };
    await app.page.startsSession(mock);

    // ********************************************************************
    // ** THEN the session says it started from the latest origin/main
    // ********************************************************************
    await expectPageToShow(app, "from origin/main");
    // AND the setup lines of the session say so too
    await app.page.opensTheSetupOutput();
    await expectPageToShow(app, "Started from the latest origin/main.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the New session dialog explains under Advanced that the branch is optional and where it starts from",
  async () => {
    // ********************************************************************
    // ** GIVEN the New session dialog is open for a repository
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.opensNewSession();
    await app.page.choosesToAddARepository();
    await app.page.typesRepositoryFolder(app.repoPath);
    await app.page.addsTheRepository();

    // ********************************************************************
    // ** WHEN the user opens the Advanced options
    // ********************************************************************
    await app.page.opensTheAdvancedOptions();

    // ********************************************************************
    // ** THEN the dialog says where a session starts from unless another branch is typed
    // ********************************************************************
    await expectDialogToShow(
      app,
      "Base branch (optional)",
      "Starts from the latest main on the remote. Change it only to start from another branch.",
    );
  },
  BROWSER_TEST_TIMEOUT_MS,
);
