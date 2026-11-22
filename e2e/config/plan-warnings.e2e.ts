import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { expectRemoteServerInBothAgents } from "../support/expect/config-agent-expectations.ts";
import {
  expectItemUnsupported,
  expectPlanToNeedSecret,
} from "../support/expect/config-expectations.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import { inUnnamedRepo, mcpServer } from "../support/setup/config-items.ts";

afterEach(cleanUpAfterTest);

const remote = {
  name: "api",
  url: "https://example.com/mcp",
  headers: { "X-Team": "core", Authorization: "Bearer ${secret:API_TOKEN}" },
};

test("a remote MCP server is written with its url and headers", async () => {
  // ********************************************************************
  // ** GIVEN the user has set up a remote MCP server with a team header
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([mcpServer({ ...remote, headers: { "X-Team": "core" } })]);

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN both agents' files have the server with its url and header
  // ********************************************************************
  await expectRemoteServerInBothAgents(app.home);
});

test("a secret placeholder is listed in the plan as a secret the user must provide", async () => {
  // ********************************************************************
  // ** GIVEN a remote MCP server whose header uses the secret API_TOKEN
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([mcpServer(remote)]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan says the server needs the secret API_TOKEN
  // ********************************************************************
  expectPlanToNeedSecret(plan, { itemId: "mcp-api", secret: "API_TOKEN" });
});

test("items that cannot be written safely are reported with the reason", async () => {
  // ********************************************************************
  // ** GIVEN an MCP server with a name no agent accepts
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  // AND an MCP server for a repository that was never named
  await app.user.setsUp([
    mcpServer({ name: "bad name", command: "npx" }),
    inUnnamedRepo(mcpServer({ name: "lost", command: "npx" })),
  ]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan says the badly named server is not a valid name, for both agents
  // ********************************************************************
  const badName = { itemId: "mcp-bad-name", reasonIncludes: "not a valid MCP server name" };
  expectItemUnsupported(plan, { agent: "claude-code", ...badName });
  expectItemUnsupported(plan, { agent: "codex", ...badName });
  // AND says the other one has no repository to go into
  const lost = { itemId: "mcp-lost", reasonIncludes: "no repository path" };
  expectItemUnsupported(plan, { agent: "codex", ...lost });
});
