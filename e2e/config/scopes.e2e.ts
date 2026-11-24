import { afterEach, test } from "bun:test";
import {
  expectFileNotToContain,
  expectFileToContain,
  expectPlanToChangeFiles,
  expectRequestToBeRefusedAs,
} from "../support/expect/config-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithItemsInTwoRepositoriesAndEverywhere } from "../support/setup/config-fixtures.ts";

afterEach(cleanUpAfterTest);

test("one review covers the files everywhere and in every repository that has items", async () => {
  // ********************************************************************
  // ** GIVEN items for everywhere, for one repository and for a second repository
  // ********************************************************************
  const { app, second, repos } = await startAppWithItemsInTwoRepositoriesAndEverywhere();

  // ********************************************************************
  // ** WHEN the user reviews the plan for both repositories and applies it
  // ********************************************************************
  const applied = await app.user.reviewsAndAppliesThePlan({ includingTheRepos: repos });

  // ********************************************************************
  // ** THEN the plan changed Claude Code's and Codex's files in all three places
  // ********************************************************************
  expectPlanToChangeFiles(applied.plan, 6);
  await expectFileToContain(app.home, { file: ".claude.json", text: "docs" });
  await expectFileToContain(app.repo, { file: ".mcp.json", text: "ui" });
  await expectFileToContain(second, { file: ".mcp.json", text: "api" });
});

test("a file that moved in one repository stops the apply everywhere", async () => {
  // ********************************************************************
  // ** GIVEN a reviewed plan for everywhere and two repositories
  // ********************************************************************
  const { app, second, repos } = await startAppWithItemsInTwoRepositoriesAndEverywhere();
  const plan = await app.user.reviewsThePlan({ includingTheRepos: repos });
  const before = [await app.home.snapshot(), await app.repo.snapshot(), await second.snapshot()];

  // ********************************************************************
  // ** WHEN a file of the second repository changes and the user applies the plan
  // ********************************************************************
  await second.has(".mcp.json", '{ "mcpServers": {} }\n');
  const refusal = await app.user.triesToApplyThePlan(plan);

  // ********************************************************************
  // ** THEN the apply is refused as stale and nothing was written anywhere
  // ********************************************************************
  expectRequestToBeRefusedAs(refusal, "config-plan-stale");
  const after = [await app.home.snapshot(), await app.repo.snapshot()];
  if (JSON.stringify(after) !== JSON.stringify(before.slice(0, 2))) {
    throw new Error("expected no file to be written in the home folder or the first repository");
  }
});

test("an item taken out of a second repository is removed from its files when the review names it", async () => {
  // ********************************************************************
  // ** GIVEN items applied for everywhere and two repositories, then the second one's item deleted
  // ********************************************************************
  const { app, second, repos } = await startAppWithItemsInTwoRepositoriesAndEverywhere();
  await app.user.reviewsAndAppliesThePlan({ includingTheRepos: repos });
  const kept = (await app.user.looksAtWhatIsSetUp()).filter((each) => each.item.id !== "mcp-api");
  await app.user.setsUp(kept);

  // ********************************************************************
  // ** WHEN the user reviews the plan for both repositories and applies it
  // ********************************************************************
  const applied = await app.user.reviewsAndAppliesThePlan({ includingTheRepos: repos });

  // ********************************************************************
  // ** THEN the second repository's files no longer list the server
  // ********************************************************************
  expectPlanToChangeFiles(applied.plan, 2);
  await expectFileNotToContain(second, { file: ".mcp.json", text: "api" });
});
