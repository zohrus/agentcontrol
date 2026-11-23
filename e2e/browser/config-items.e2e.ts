import { afterEach, test } from "bun:test";
import {
  expectConfigNotToShow,
  expectConfigToShow,
  expectFormToSay,
  expectItemToBeSwitchedOff,
} from "../support/browser/config-browser-expectations.ts";
import { startConfigAppWithAServer } from "../support/browser/config-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "instructions, permission rules and hooks can each be added from their own tab",
  async () => {
    // ********************************************************************
    // ** GIVEN the Config screen is open with nothing set up
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.opensConfig();

    // ********************************************************************
    // ** WHEN the user adds an instruction, a permission rule and a hook
    // ********************************************************************
    const instruction = { Name: "team-rules", "What the agents should know": "Write tests first." };
    await app.page.addsItem({ tab: "Instructions", noun: "instruction", fields: instruction });
    await expectConfigToShow(app, "team-rules", "Write tests first.");
    const rule = { "Always allow": "Bash(ls:*)" };
    await app.page.addsItem({ tab: "Permissions", noun: "permission rule set", fields: rule });
    await expectConfigToShow(app, "Permission rules", "1 allowed, 0 denied");
    const hook = { Name: "audit", "Command to run": "echo checking" };
    await app.page.addsItem({ tab: "Hooks", noun: "hook", fields: hook });

    // ********************************************************************
    // ** THEN the hook is listed with when it runs
    // ********************************************************************
    await expectConfigToShow(app, "audit", "before-tool: echo checking");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "skills, commands and environment variables can each be added from their own tab",
  async () => {
    // ********************************************************************
    // ** GIVEN the Config screen is open with nothing set up
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.opensConfig();

    // ********************************************************************
    // ** WHEN the user adds a skill, a command and a set of environment variables
    // ********************************************************************
    const skill = { Name: "review", "SKILL.md": "---\nname: review\n---\nBe careful.\n" };
    await app.page.addsItem({ tab: "Skills", noun: "skill", fields: skill });
    await expectConfigToShow(app, "review", "1 file");
    const command = { Name: "ship", Prompt: "Ship it." };
    await app.page.addsItem({ tab: "Commands", noun: "command", fields: command });
    await expectConfigToShow(app, "ship", "Ship it.");
    const vars = { Variables: "GREETING=hello" };
    await app.page.addsItem({ tab: "Environment", noun: "environment variable set", fields: vars });

    // ********************************************************************
    // ** THEN the variables are listed by name
    // ********************************************************************
    await expectConfigToShow(app, "Environment variables", "GREETING");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an item can be edited and the list shows what it is now",
  async () => {
    // ********************************************************************
    // ** GIVEN an MCP server called docs that runs npx
    // ********************************************************************
    const app = await startConfigAppWithAServer();
    await app.page.opensConfig();
    await expectConfigToShow(app, "docs", "npx");

    // ********************************************************************
    // ** WHEN the user edits it to run node instead
    // ********************************************************************
    await app.page.editsItem("docs", { noun: "MCP server", fields: { Command: "node" } });

    // ********************************************************************
    // ** THEN the list shows node, and no longer npx
    // ********************************************************************
    await expectConfigToShow(app, "node");
    await expectConfigNotToShow(app, "npx");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an item can be switched off and then deleted",
  async () => {
    // ********************************************************************
    // ** GIVEN an MCP server called docs
    // ********************************************************************
    const app = await startConfigAppWithAServer();
    await app.page.opensConfig();
    await expectConfigToShow(app, "docs");

    // ********************************************************************
    // ** WHEN the user switches it off
    // ********************************************************************
    await app.page.switchesOff("docs");

    // ********************************************************************
    // ** THEN the app keeps it, switched off
    // ********************************************************************
    await expectItemToBeSwitchedOff(app, "mcp-docs");
    // AND deleting it removes it from the list
    await app.page.deletes("docs");
    await expectConfigNotToShow(app, "npx");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a form that is not filled in says what is missing in plain words",
  async () => {
    // ********************************************************************
    // ** GIVEN the form for a new MCP server is open
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.opensConfig();
    await app.page.opensTheFormFor("MCP server");

    // ********************************************************************
    // ** WHEN the user saves it with nothing typed
    // ********************************************************************
    await app.page.savesTheForm("Add", "MCP server");

    // ********************************************************************
    // ** THEN the form asks for a name
    // ********************************************************************
    await expectFormToSay(app, { verb: "Add", noun: "MCP server", text: "Give it a name." });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
