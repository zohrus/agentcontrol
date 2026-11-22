import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  expectDriftIn,
  expectItemsSetUp,
  expectItemUnsupported,
  expectNoFile,
  expectPlanToChangeFiles,
  expectRequestToBeRefusedAs,
} from "../support/expect/config-expectations.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import { instructions, mcpServer, skill } from "../support/setup/config-items.ts";
import {
  startAppWithAnAppliedMcpServer,
  startAppWithAReviewedPlan,
} from "../support/setup/config-fixtures.ts";

afterEach(cleanUpAfterTest);

test("an apply that fails half way puts every file back", async () => {
  // ********************************************************************
  // ** GIVEN a plan that writes Claude Code's file and then Codex's folder
  // ********************************************************************
  const { app, plan } = await startAppWithAReviewedPlan();

  // ********************************************************************
  // ** WHEN a plain file takes the place of Codex's folder and the user applies the plan
  // ********************************************************************
  await app.home.has(".codex", "not a folder");
  const refusal = await app.user.triesToApplyThePlan(plan);

  // ********************************************************************
  // ** THEN the apply fails, and Claude Code's file it had already written is gone again
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "internal-error");
  await expectNoFile(app.home, ".claude.json");
});

test("a plan cannot be applied twice", async () => {
  // ********************************************************************
  // ** GIVEN a plan that has been applied
  // ********************************************************************
  const { app, applied } = await startAppWithAnAppliedMcpServer();

  // ********************************************************************
  // ** WHEN the user applies the same plan again
  // ********************************************************************
  const refusal = await app.user.triesToApplyThePlan(applied.plan);

  // ********************************************************************
  // ** THEN the app refuses it as stale
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "config-plan-stale");
});

test("a config path that is a folder makes the plan fail instead of being overwritten", async () => {
  // ********************************************************************
  // ** GIVEN a folder where Claude Code's settings file should be
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.home.hasAFolderAt(".claude.json");
  await app.user.setsUp([mcpServer({ name: "docs", command: "npx" })]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const refusal = await app.user.triesToReviewThePlan();

  // ********************************************************************
  // ** THEN the app refuses to plan
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "internal-error");
});

test("a managed file that stopped being valid JSON is reported as drift", async () => {
  // ********************************************************************
  // ** GIVEN a setup that has been applied
  // ********************************************************************
  const { app } = await startAppWithAnAppliedMcpServer();

  // ********************************************************************
  // ** WHEN the user breaks Claude Code's file by hand
  // ********************************************************************
  await app.home.has(".claude.json", "{ not json");

  // ********************************************************************
  // ** THEN the drift report flags it
  // ********************************************************************
  expectDriftIn(await app.user.checksForDrift(), { file: ".claude.json", itemId: "mcp-docs" });
});

test("a damaged manifest does not stop the next plan", async () => {
  // ********************************************************************
  // ** GIVEN a setup that has been applied and a manifest that was damaged
  // ********************************************************************
  const { app } = await startAppWithAnAppliedMcpServer();
  await app.home.has(".agentcontrol/managed.json", "damaged");

  // ********************************************************************
  // ** WHEN the user reviews the plan again
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan recognises the entries already in place and changes nothing but the manifest
  // ********************************************************************
  expectPlanToChangeFiles(plan, 0);
});

test("a skill file that would leave the skill folder is reported", async () => {
  // ********************************************************************
  // ** GIVEN a skill whose file path leaves the skill folder
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([skill({ name: "review", text: "x", path: "../escape.md" })]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan says the skill cannot be written, and why
  // ********************************************************************
  const call = {
    agent: "codex",
    itemId: "skill-review",
    reasonIncludes: "leaves the skill folder",
  };
  expectItemUnsupported(plan, call);
});

test("an item id that could break the markers is reported as unsupported", async () => {
  // ********************************************************************
  // ** GIVEN an instruction whose id has a space in it
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([instructions({ id: "has space", text: "x" })]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan says the id may only use letters, digits and a few signs
  // ********************************************************************
  const call = { agent: "codex", itemId: "has space", reasonIncludes: "letters, digits" };
  expectItemUnsupported(plan, call);
});

test("importing from a settings file that is not valid JSON finds nothing in it and does not fail", async () => {
  // ********************************************************************
  // ** GIVEN a Claude Code settings file the user left half edited
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.home.has(".claude/settings.json", '{ "permissions": ');

  // ********************************************************************
  // ** WHEN the user imports the existing setup
  // ********************************************************************
  const items = await app.user.importsTheExistingSetup();

  // ********************************************************************
  // ** THEN nothing comes back from that file
  // ********************************************************************
  expectItemsSetUp(items, 0);
});

test("only the latest plans can still be applied", async () => {
  // ********************************************************************
  // ** GIVEN a plan the user reviewed first
  // ********************************************************************
  const { app, plan } = await startAppWithAReviewedPlan();

  // ********************************************************************
  // ** WHEN the user reviews the plan 30 more times and then applies the first one
  // ********************************************************************
  await app.user.reviewsThePlanAgain(30);
  const refusal = await app.user.triesToApplyThePlan(plan);

  // ********************************************************************
  // ** THEN the app refuses it as stale
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "config-plan-stale");
});
