import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  expectFileToContain,
  expectItemsSetUp,
  expectJsonValue,
  expectNoFile,
  expectPlanToChangeFiles,
} from "../support/expect/config-expectations.ts";
import { expectImportedItem } from "../support/expect/config-import-expectations.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import { startAppWithAServerForOneRepository } from "../support/setup/config-fixtures.ts";
import { startAppWithHandWrittenSetupToImport } from "../support/setup/config-fixtures.ts";
import { mcpServer, switchedOff } from "../support/setup/config-items.ts";

afterEach(cleanUpAfterTest);

test("importing an existing hand-written setup returns it as items", async () => {
  // ********************************************************************
  // ** GIVEN a home folder where the user hand-wrote both agents' config
  // ********************************************************************
  const app = await startAppWithHandWrittenSetupToImport();

  // ********************************************************************
  // ** WHEN the user imports the existing setup
  // ********************************************************************
  const items = await app.user.importsTheExistingSetup();

  // ********************************************************************
  // ** THEN the server comes back once per agent
  // ********************************************************************
  expectImportedItem(items, { id: "claude-code:mcp:fs", kind: "mcp" });
  expectImportedItem(items, { id: "codex:mcp:fs", kind: "mcp" });
  // AND the permission rule and the notes come back from Claude Code
  expectImportedItem(items, { id: "claude-code:permission", kind: "permission" });
  expectImportedItem(items, { id: "claude-code:instructions:global", kind: "instructions" });
  // AND the command whose description is plain text
  expectImportedItem(items, { id: "claude-code:command:hello", kind: "command" });
});

test("a repo-scoped item is written into the repository, not the home folder", async () => {
  // ********************************************************************
  // ** GIVEN an MCP server that the user set up for one repository only
  // ********************************************************************
  const app = await startAppWithAServerForOneRepository();

  // ********************************************************************
  // ** WHEN the user reviews the plan for that repository and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan({ includingTheRepo: true });

  // ********************************************************************
  // ** THEN the repository's own Claude Code and Codex files list the server
  // ********************************************************************
  const server = { file: ".mcp.json", path: "mcpServers.docs.command", value: "npx" };
  await expectJsonValue(app.repo, server);
  await expectFileToContain(app.repo, { file: ".codex/config.toml", text: "[mcp_servers.docs]" });
  // AND the home folder has no Claude Code or Codex server file
  await expectNoFile(app.home, ".claude.json");
  await expectNoFile(app.home, ".codex/config.toml");
});

test("an item that is switched off is not written", async () => {
  // ********************************************************************
  // ** GIVEN an MCP server that the user has switched off
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([switchedOff(mcpServer({ name: "docs", command: "npx" }))]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan lists no file to change
  // ********************************************************************
  expectPlanToChangeFiles(plan, 0);
});

test("a server of the same name at home and in a repository is imported as two items", async () => {
  // ********************************************************************
  // ** GIVEN a server "db" in the home folder and a different "db" in the repository
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.home.has(".claude.json", '{ "mcpServers": { "db": { "command": "home-db" } } }\n');
  await app.repo.has(".mcp.json", '{ "mcpServers": { "db": { "command": "repo-db" } } }\n');

  // ********************************************************************
  // ** WHEN the user imports the setup including the repository and keeps all of it
  // ********************************************************************
  const imported = await app.user.importsTheExistingSetup({ includingTheRepo: true });
  await app.user.setsUp(imported);

  // ********************************************************************
  // ** THEN the app holds both servers
  // ********************************************************************
  expectItemsSetUp(await app.user.looksAtWhatIsSetUp(), 2);
});
