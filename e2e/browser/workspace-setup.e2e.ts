import { afterEach, test } from "bun:test";
import { gitWithoutIdentity } from "../support/browser/git-identity.ts";
import { expectChecklistStep } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import {
  expectRepoSetupToBeKept,
  expectSaveSetupToBe,
} from "../support/browser/workspace-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "Config lists what the machine needs and says what is missing in plain words",
  async () => {
    // ********************************************************************
    // ** GIVEN an app on a machine where git has no name and email yet
    // ********************************************************************
    const git = await gitWithoutIdentity();
    const app = await startAppInBrowser({ relayEnv: git.relayEnv });

    // ********************************************************************
    // ** WHEN the user opens Config
    // ********************************************************************
    await app.page.opensWorkspaceSetup();

    // ********************************************************************
    // ** THEN the checklist says the git identity is missing and how to set it
    // ********************************************************************
    const missing = { label: "Git identity", state: "Failed", text: "Set your name and email" };
    await expectChecklistStep(app, missing);
    // AND it says git itself is installed
    await expectChecklistStep(app, { label: "Git", state: "Passed", text: "git version" });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Check and repair checks again and shows what the user has fixed since",
  async () => {
    // ********************************************************************
    // ** GIVEN the checklist is open and says the git identity is missing
    // ********************************************************************
    const git = await gitWithoutIdentity();
    const app = await startAppInBrowser({ relayEnv: git.relayEnv });
    await app.page.opensWorkspaceSetup();
    await expectChecklistStep(app, {
      label: "Git identity",
      state: "Failed",
      text: "Set your name",
    });

    // ********************************************************************
    // ** WHEN the user sets their git name and email and presses Check and repair
    // ********************************************************************
    await git.setsUpTheirIdentity();
    await app.page.checksAndRepairs();

    // ********************************************************************
    // ** THEN the git identity step passes and shows who the user is
    // ********************************************************************
    await expectChecklistStep(app, { label: "Git identity", state: "Passed", text: "Test User" });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the worktree setup of a repository can be edited and saved from Config",
  async () => {
    // ********************************************************************
    // ** GIVEN a repository the app knows, with the default setup, and Config open
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.user.addsTheRepo();
    await app.page.reloads();
    await app.page.opensWorkspaceSetup();
    // AND nothing is changed yet, so there is nothing to save
    await expectSaveSetupToBe(app, "disabled");

    // ********************************************************************
    // ** WHEN the user swaps the file to copy, adds a setup script and saves
    // ********************************************************************
    await app.page.removesFilePattern(".env*");
    await app.page.addsFilePattern();
    await app.page.typesFilePattern(1, "config/local.json");
    await app.page.typesSetupScript("echo ready");
    await expectSaveSetupToBe(app, "enabled");
    await app.page.savesTheSetup();

    // ********************************************************************
    // ** THEN the app keeps the new files and script for the repository
    // ********************************************************************
    await expectRepoSetupToBeKept(app, {
      copyFiles: ["config/local.json"],
      setupScript: "echo ready",
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
