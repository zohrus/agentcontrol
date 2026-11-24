import { afterEach, test } from "bun:test";
import {
  expectDialogToShow,
  expectNoDialogToBeOpen,
  expectNoToasts,
  expectToastToShow,
} from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the New session dialog says in plain words what is still missing and cannot be started yet",
  async () => {
    // ********************************************************************
    // ** GIVEN the New session dialog is open in an app that knows no repository yet
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.opensNewSession();

    // ********************************************************************
    // ** WHEN the user leaves the fields empty or wrong
    // ********************************************************************
    await app.page.leavesRepositoryChoice();
    await app.page.typesBaseBranch("my branch");
    await app.page.leavesField("Base branch");

    // ********************************************************************
    // ** THEN the dialog explains each problem and Start is not offered
    // ********************************************************************
    await expectDialogToShow(
      app,
      "Choose a repository to work in.",
      "A branch name cannot contain spaces.",
      "Choose a repository and an agent to create the session.",
    );
    // AND closing the dialog with Cancel leaves nothing open
    await app.page.cancelsTheDialog();
    await expectNoDialogToBeOpen(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "choosing to add a repository without adding one is pointed out",
  async () => {
    // ********************************************************************
    // ** GIVEN the New session dialog is open
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.opensNewSession();

    // ********************************************************************
    // ** WHEN the user picks "Add repository…" and leaves without typing a folder
    // ********************************************************************
    await app.page.choosesToAddARepository();
    await app.page.leavesRepositoryChoice();

    // ********************************************************************
    // ** THEN the dialog tells the user to type the folder and press Add
    // ********************************************************************
    await expectDialogToShow(app, "Type the folder of the repository and press Add.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "adding a folder that is not a git repository is reported and can be dismissed",
  async () => {
    // ********************************************************************
    // ** GIVEN the New session dialog is open with "Add repository…" chosen
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the user adds a folder that does not exist
    // ********************************************************************
    await app.page.triesToAddRepository("/no/such/folder");

    // ********************************************************************
    // ** THEN a message in the corner explains that it could not be used
    // ********************************************************************
    await expectToastToShow(app, "Something went wrong inside AgentControl.");
    // AND the message can be dismissed
    await app.page.dismissesTheToast();
    await expectNoToasts(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
