import { afterEach, test } from "bun:test";
import {
  expectFileToContain,
  expectItemUnsupported,
  expectPlanToChangeFiles,
} from "../support/expect/config-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import { environment, mcpServer, onlyInRepo, skill } from "../support/setup/config-items.ts";

afterEach(cleanUpAfterTest);

test("a plan made without the repository leaves the repository's config alone", async () => {
  // ********************************************************************
  // ** GIVEN an MCP server for one repository that has been applied to that repository
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([onlyInRepo(mcpServer({ name: "docs", command: "npx" }), app.repo.path)]);
  await app.user.reviewsAndAppliesThePlan({ includingTheRepo: true });

  // ********************************************************************
  // ** WHEN the user reviews a plan that names no repository
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan does not remove the server from the repository's files
  // ********************************************************************
  expectPlanToChangeFiles(plan, 0);
});

test("an empty file in a skill is created", async () => {
  // ********************************************************************
  // ** GIVEN a skill that includes an empty file
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([skill({ name: "review", text: "", path: "empty.txt" })]);

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN Claude Code's skill folder has the empty file
  // ********************************************************************
  await expectFileToContain(app.home, { file: ".claude/skills/review/empty.txt", text: "" });
});

test("a Codex variable table that the user defined inline is not defined a second time", async () => {
  // ********************************************************************
  // ** GIVEN a Codex file where the user set their variables inline
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.home.has(".codex/config.toml", '[shell_environment_policy]\nset = { A = "1" }\n');
  // AND the user sets up another variable in the app
  await app.user.setsUp([environment({ B: "2" })]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan leaves Codex's file alone and says why
  // ********************************************************************
  const call = { agent: "codex", itemId: "env", reasonIncludes: "already exists" };
  expectItemUnsupported(plan, call);
});
