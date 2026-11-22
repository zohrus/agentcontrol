import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  expectClaudeCodeToListServer,
  expectCodexToListServer,
  expectHandWrittenConfigToBeKept,
} from "./support/expect/agent-expectations.ts";
import {
  expectFileToContain,
  expectFilesToBeWrittenAsPlanned,
  expectPlanToChangeFiles,
} from "./support/expect/config-expectations.ts";
import { startAppWithEmptyHome } from "./support/setup/config-app.ts";
import { startAppWithHandWrittenAgentConfig } from "./support/setup/config-fixtures.ts";
import { mcpServer } from "./support/setup/items.ts";

afterEach(cleanUpAfterTest);

const docs = { name: "docs", command: "npx" };

test("an MCP server added in the app appears in Claude Code's and Codex's files as the plan showed", async () => {
  // ********************************************************************
  // ** GIVEN the app with an empty home folder
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  // AND the user has set up an MCP server "docs" that runs `npx`
  await app.user.setsUp([mcpServer(docs)]);

  // ********************************************************************
  // ** WHEN the user reviews the plan and then applies it
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();
  await app.user.appliesThePlan(plan);

  // ********************************************************************
  // ** THEN Claude Code's file and Codex's file both list the server
  // ********************************************************************
  await expectClaudeCodeToListServer(app.home, docs);
  await expectCodexToListServer(app.home, docs);
  // AND the plan named those two files and every file holds exactly what the plan showed
  expectPlanToChangeFiles(plan, 2);
  await expectFilesToBeWrittenAsPlanned(plan);
});

test("hand-written config next to a managed entry is left untouched", async () => {
  // ********************************************************************
  // ** GIVEN a home folder where the user already wrote their own settings and MCP server
  // ********************************************************************
  const app = await startAppWithHandWrittenAgentConfig();
  // AND the user has set up an MCP server "docs" in the app
  await app.user.setsUp([mcpServer(docs)]);

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN everything the user wrote by hand is still there
  // ********************************************************************
  await expectHandWrittenConfigToBeKept(app.home);
  // AND "docs" is listed next to it in both files
  await expectClaudeCodeToListServer(app.home, docs);
  await expectCodexToListServer(app.home, docs);
});

test("an MCP server whose name the user already used by hand is not overwritten", async () => {
  // ********************************************************************
  // ** GIVEN a Codex file where the user wrote their own server "docs"
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  const own = '[mcp_servers.docs]\ncommand = "my-docs"\n';
  await app.home.has(".codex/config.toml", own);
  // AND the user sets up a different MCP server called "docs" in the app
  await app.user.setsUp([mcpServer(docs)]);

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN the user's own server is still in Codex's file, unchanged
  // ********************************************************************
  await expectFileToContain(app.home, { file: ".codex/config.toml", text: own });
});
