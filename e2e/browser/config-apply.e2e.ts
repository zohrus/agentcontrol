import { afterEach, test } from "bun:test";
import {
  expectConfigToShow,
  expectUndoWarningToName,
} from "../support/browser/config-browser-expectations.ts";
import {
  startConfigAppAfterApplyingAServerInTheScreen,
  startConfigAppWithAServerAddedInTheScreen,
} from "../support/browser/config-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { expectFileToContain, expectNoFile } from "../support/expect/config-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

const editedLater = '{ "numStartups": 3 }\n';

test(
  "applying a reviewed MCP server writes both agents' files and lists them",
  async () => {
    // ********************************************************************
    // ** GIVEN the user added an MCP server called docs and is looking at the review
    // ********************************************************************
    const app = await startConfigAppWithAServerAddedInTheScreen();
    await app.page.reviewsTheChanges();

    // ********************************************************************
    // ** WHEN the user applies the changes
    // ********************************************************************
    await app.page.appliesTheChanges();

    // ********************************************************************
    // ** THEN the screen lists the files that were written
    // ********************************************************************
    await expectConfigToShow(app, "Applied.", ".claude.json", ".codex/config.toml");
    // AND the files in the home folder hold the server
    await expectFileToContain(app.home, { file: ".claude.json", text: "docs" });
    await expectFileToContain(app.home, { file: ".codex/config.toml", text: "[mcp_servers.docs]" });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "undoing an apply puts the files back as they were",
  async () => {
    // ********************************************************************
    // ** GIVEN an MCP server was applied to an empty home folder
    // ********************************************************************
    const app = await startConfigAppAfterApplyingAServerInTheScreen();

    // ********************************************************************
    // ** WHEN the user presses Undo this apply
    // ********************************************************************
    await app.page.undoesTheApply();

    // ********************************************************************
    // ** THEN the screen says the files are back as they were
    // ********************************************************************
    await expectConfigToShow(app, "Undone");
    // AND the files the apply created are gone
    await expectNoFile(app.home, ".claude.json");
    await expectNoFile(app.home, ".codex/config.toml");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "undoing over a file that changed since asks first and then restores it",
  async () => {
    // ********************************************************************
    // ** GIVEN an applied MCP server, after which Claude Code rewrote its own file
    // ********************************************************************
    const app = await startConfigAppAfterApplyingAServerInTheScreen();
    await app.home.has(".claude.json", editedLater);

    // ********************************************************************
    // ** WHEN the user presses Undo this apply
    // ********************************************************************
    await app.page.undoesTheApply();

    // ********************************************************************
    // ** THEN the screen warns that .claude.json changed since, and restores nothing yet
    // ********************************************************************
    await expectUndoWarningToName(app, ".claude.json");
    await expectFileToContain(app.home, { file: ".codex/config.toml", text: "docs" });
    // AND confirming restores every file
    await app.page.confirmsUndoAnyway();
    await expectConfigToShow(app, "Undone");
    await expectNoFile(app.home, ".codex/config.toml");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "declining to undo over a changed file keeps the apply, so it can still be undone",
  async () => {
    // ********************************************************************
    // ** GIVEN an applied MCP server, and Claude Code rewrote its own file afterwards
    // ********************************************************************
    const app = await startConfigAppAfterApplyingAServerInTheScreen();
    // AND Claude Code rewrote its own file after the apply
    await app.home.has(".claude.json", editedLater);
    // AND the user pressed Undo this apply and saw the warning about that file
    await app.page.undoesTheApply();
    await expectUndoWarningToName(app, ".claude.json");

    // ********************************************************************
    // ** WHEN the user cancels the warning
    // ********************************************************************
    await app.page.cancelsTheUndoWarning();

    // ********************************************************************
    // ** THEN the screen still shows the apply with Undo this apply, and nothing was restored
    // ********************************************************************
    await expectConfigToShow(app, "Applied.", "Undo this apply");
    await expectFileToContain(app.home, { file: ".codex/config.toml", text: "docs" });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
