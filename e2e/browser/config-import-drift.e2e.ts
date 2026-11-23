import { afterEach, test } from "bun:test";
import {
  expectConfigToShow,
  expectDriftBannerToName,
  expectNoDriftBanner,
  expectReviewToListFile,
} from "../support/browser/config-browser-expectations.ts";
import {
  startConfigAppWithAnAppliedServer,
  startConfigAppWithAServerEditedByHand,
  startConfigAppWithAnExistingSetup,
} from "../support/browser/config-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { expectFileToContain } from "../support/expect/config-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "importing the existing setup lists what each agent has and adopts the chosen items",
  async () => {
    // ********************************************************************
    // ** GIVEN both agents already have an MCP server called fs, written by hand
    // ********************************************************************
    const app = await startConfigAppWithAnExistingSetup();
    await app.page.opensConfig();

    // ********************************************************************
    // ** WHEN the user imports the existing setup
    // ********************************************************************
    await app.page.importsExistingSetup();

    // ********************************************************************
    // ** THEN the screen lists fs under Claude Code and under Codex
    // ********************************************************************
    await expectConfigToShow(app, "Claude Code", "Codex", "fs");
    // AND adopting the selection puts both servers among the MCP servers
    await app.page.adoptsTheSelection();
    await expectConfigToShow(app, "Adopted 2 item(s)", "MCP servers");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a file edited by hand shows a banner, and Overwrite writes the item again after review",
  async () => {
    // ********************************************************************
    // ** GIVEN an applied MCP server that the user then edited by hand in Claude Code's file
    // ********************************************************************
    const app = await startConfigAppWithAServerEditedByHand();

    // ********************************************************************
    // ** WHEN the user opens Config and chooses Overwrite
    // ********************************************************************
    await app.page.opensConfig();
    await expectDriftBannerToName(app, ".claude.json");
    await app.page.overwritesMyManualEdit();

    // ********************************************************************
    // ** THEN the review shows Claude Code's file being changed back
    // ********************************************************************
    await expectReviewToListFile(app, {
      agent: "Claude Code",
      file: ".claude.json",
      action: "Changed",
    });
    // AND applying fixes the file and the banner is gone
    await app.page.appliesTheChanges();
    await expectConfigToShow(app, "Applied.");
    await expectFileToContain(app.home, { file: ".claude.json", text: '"npx"' });
    await app.page.doneWithTheApply();
    await expectNoDriftBanner(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Keep my manual edit takes the hand edit into the item and shows what the other agent gets",
  async () => {
    // ********************************************************************
    // ** GIVEN an applied MCP server that the user edited by hand in Claude Code's file
    // ********************************************************************
    const app = await startConfigAppWithAServerEditedByHand();

    // ********************************************************************
    // ** WHEN the user opens Config and chooses Keep my manual edit
    // ********************************************************************
    await app.page.opensConfig();
    await expectDriftBannerToName(app, ".claude.json");
    await app.page.keepsMyManualEdit();

    // ********************************************************************
    // ** THEN the review leaves Claude Code's file alone and changes Codex's to match
    // ********************************************************************
    await expectReviewToListFile(app, {
      agent: "Codex",
      file: ".codex/config.toml",
      action: "Changed",
    });
    // AND applying records the edit, so the banner is gone
    await app.page.appliesTheChanges();
    await app.page.doneWithTheApply();
    await expectNoDriftBanner(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an entry removed by hand is offered to be written again",
  async () => {
    // ********************************************************************
    // ** GIVEN an applied MCP server that the user then deleted from Claude Code's file
    // ********************************************************************
    const app = await startConfigAppWithAnAppliedServer();
    await app.home.has(".claude.json", "{}\n");

    // ********************************************************************
    // ** WHEN the user opens Config and chooses to write it again
    // ********************************************************************
    await app.page.opensConfig();
    await expectDriftBannerToName(app, "no longer has");
    await app.page.writesTheEntryAgain();

    // ********************************************************************
    // ** THEN the review shows Claude Code's file being changed to hold the server again
    // ********************************************************************
    await expectReviewToListFile(app, {
      agent: "Claude Code",
      file: ".claude.json",
      action: "Changed",
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
