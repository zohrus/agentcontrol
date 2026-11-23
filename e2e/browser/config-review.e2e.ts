import { afterEach, test } from "bun:test";
import {
  expectConfigToShow,
  expectNoAgentFilesToBeWritten,
  expectReviewToExplain,
  expectReviewToListFile,
} from "../support/browser/config-browser-expectations.ts";
import {
  startConfigAppWithACommand,
  startConfigAppWithAServerAddedInTheScreen,
} from "../support/browser/config-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a new MCP server is reviewed file by file for both agents before anything is written",
  async () => {
    // ********************************************************************
    // ** GIVEN the user added an MCP server called docs in the Config screen
    // ********************************************************************
    const app = await startConfigAppWithAServerAddedInTheScreen();

    // ********************************************************************
    // ** WHEN the user asks to review the changes
    // ********************************************************************
    await app.page.reviewsTheChanges();

    // ********************************************************************
    // ** THEN the review lists Claude Code's file and Codex's file as new
    // ********************************************************************
    await expectReviewToListFile(app, {
      agent: "Claude Code",
      file: ".claude.json",
      action: "New file",
    });
    await expectReviewToListFile(app, {
      agent: "Codex",
      file: ".codex/config.toml",
      action: "New file",
    });
    // AND nothing has been written to the home folder yet
    await expectNoAgentFilesToBeWritten(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an item that an agent cannot take is explained in the review",
  async () => {
    // ********************************************************************
    // ** GIVEN a slash command is set up, which Codex does not support
    // ********************************************************************
    const app = await startConfigAppWithACommand();
    await app.page.opensConfig();

    // ********************************************************************
    // ** WHEN the user reviews the changes
    // ********************************************************************
    await app.page.reviewsTheChanges();

    // ********************************************************************
    // ** THEN the review says the command is not written for Codex, and why
    // ********************************************************************
    await expectReviewToExplain(app, "ship is not written for Codex");
    // AND back in the list, the command says Codex will not get it
    await app.page.goesBackToEditing();
    await app.page.opensTab("Commands");
    await expectConfigToShow(app, "Codex will not get this");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
