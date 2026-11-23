import { afterEach, test } from "bun:test";
import {
  expectConfigToShow,
  expectReviewToExplain,
  expectReviewToListFile,
} from "../support/browser/config-browser-expectations.ts";
import {
  startConfigAppKnowingTheRepository,
  startConfigAppWithAServerThatNeedsASecret,
} from "../support/browser/config-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "an item limited to one repository is reviewed with that repository's own files",
  async () => {
    // ********************************************************************
    // ** GIVEN the app knows a repository and the Config screen is open
    // ********************************************************************
    const app = await startConfigAppKnowingTheRepository();
    await app.page.opensConfig();

    // ********************************************************************
    // ** WHEN the user adds an MCP server only for that repository and reviews the changes
    // ********************************************************************
    const server = { Name: "docs", Command: "npx" };
    await app.page.addsItem({ noun: "MCP server", fields: server, onlyIn: app.repoPath });
    await expectConfigToShow(app, `Only in ${app.repoPath}`);
    await app.page.reviewsTheChanges();

    // ********************************************************************
    // ** THEN the review lists the repository's own Claude Code file
    // ********************************************************************
    await expectReviewToListFile(app, {
      agent: "Claude Code",
      file: ".mcp.json",
      action: "New file",
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a server that needs a secret is explained in the review",
  async () => {
    // ********************************************************************
    // ** GIVEN an MCP server whose token is a secret that is not stored anywhere yet
    // ********************************************************************
    const app = await startConfigAppWithAServerThatNeedsASecret();
    await app.page.opensConfig();

    // ********************************************************************
    // ** WHEN the user reviews the changes
    // ********************************************************************
    await app.page.reviewsTheChanges();

    // ********************************************************************
    // ** THEN the review says the server needs the secret API_TOKEN
    // ********************************************************************
    await expectReviewToExplain(app, "api needs the secret API_TOKEN");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
