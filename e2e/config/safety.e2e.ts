import { afterEach, test } from "bun:test";
import {
  expectRequestToBeRefusedAs,
  expectDriftIn,
  expectNoDrift,
  expectNoFile,
  expectPlanToChangeFiles,
  expectSameFiles,
} from "../support/expect/config-expectations.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import {
  startAppWithAnAppliedMcpServer,
  startAppWithAReviewedPlan,
} from "../support/setup/config-fixtures.ts";
import { instructions, mcpServer, onlyInRepo } from "../support/setup/config-items.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test("applying the same setup twice changes nothing", async () => {
  // ********************************************************************
  // ** GIVEN a setup that has already been applied once
  // ********************************************************************
  const { app } = await startAppWithAnAppliedMcpServer();
  const filesBefore = await app.home.snapshot();

  // ********************************************************************
  // ** WHEN the user reviews the plan again and applies it
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();
  await app.user.appliesThePlan(plan);

  // ********************************************************************
  // ** THEN the plan lists no file to change
  // ********************************************************************
  expectPlanToChangeFiles(plan, 0);
  // AND every file is byte for byte as it was
  expectSameFiles({ before: filesBefore, after: await app.home.snapshot() });
  // AND nothing is reported as drifted
  expectNoDrift(await app.user.checksForDrift());
});

test("a managed entry edited by hand is reported as drift", async () => {
  // ********************************************************************
  // ** GIVEN a setup that has been applied
  // ********************************************************************
  const { app } = await startAppWithAnAppliedMcpServer();

  // ********************************************************************
  // ** WHEN the user edits the "docs" server by hand in Claude Code's file
  // ********************************************************************
  await app.home.edits(".claude.json", { replace: '"npx"', with: '"node"' });

  // ********************************************************************
  // ** THEN the drift report flags that file for the "docs" server
  // ********************************************************************
  expectDriftIn(await app.user.checksForDrift(), { file: ".claude.json", itemId: "mcp-docs" });
});

test("rolling back restores every file byte for byte and removes the files that were created", async () => {
  // ********************************************************************
  // ** GIVEN a home folder with the user's own Claude Code settings and no Codex files
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.home.has(".claude.json", '{\n  "theme": "dark"\n}\n');
  const filesBefore = await app.home.snapshot();
  // AND an MCP server and an instruction that the user applies
  await app.user.setsUp([
    mcpServer({ name: "docs", command: "npx" }),
    instructions({ id: "team-rules", text: "Always write tests first." }),
  ]);
  const applied = await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** WHEN the user rolls the apply back
  // ********************************************************************
  await app.user.rollsBack(applied);

  // ********************************************************************
  // ** THEN every file is byte for byte as it was before the apply
  // ********************************************************************
  expectSameFiles({ before: filesBefore, after: await app.home.snapshot() });
  // AND the files the apply created are gone
  await expectNoFile(app.home, ".codex/config.toml");
  await expectNoFile(app.home, ".claude/CLAUDE.md");
});

test("a plan is refused when a file it covers changed after the plan was made", async () => {
  // ********************************************************************
  // ** GIVEN a plan the user has reviewed for a new MCP server
  // ********************************************************************
  const { app, plan } = await startAppWithAReviewedPlan();

  // ********************************************************************
  // ** WHEN Claude Code rewrites its own file and then the user applies the plan
  // ********************************************************************
  await app.home.has(".claude.json", '{ "numStartups": 3 }\n');
  const refusal = await app.user.triesToApplyThePlan(plan);

  // ********************************************************************
  // ** THEN the app refuses it as stale, so nothing is overwritten
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "config-plan-stale");
});

test("an id that is not a backup is refused instead of being followed out of the backups folder", async () => {
  // ********************************************************************
  // ** GIVEN the app with an empty home folder
  // ********************************************************************
  const app = await startAppWithEmptyHome();

  // ********************************************************************
  // ** WHEN the user asks to roll back to "../../elsewhere"
  // ********************************************************************
  const refusal = await app.user.triesToRollBackTo("../../elsewhere");

  // ********************************************************************
  // ** THEN the app refuses the request as invalid
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "invalid-request");
});

test("two different items with the same id are refused instead of one silently winning", async () => {
  // ********************************************************************
  // ** GIVEN the app with an empty home folder
  // ********************************************************************
  const app = await startAppWithEmptyHome();

  // ********************************************************************
  // ** WHEN the user sets up two different MCP servers that share one id
  // ********************************************************************
  const other = onlyInRepo(mcpServer({ name: "docs", command: "node" }), "/repo");
  const refusal = await app.user.triesToSetUp([mcpServer({ name: "docs", command: "npx" }), other]);

  // ********************************************************************
  // ** THEN the app refuses the request as invalid
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "invalid-request");
});
