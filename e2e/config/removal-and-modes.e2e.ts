import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  expectHandWrittenConfigToBeKept,
  expectManagedEntriesToBeGone,
  expectModeAndVariableInBothAgents,
  expectNoLeftoverSections,
} from "../support/expect/config-agent-expectations.ts";
import {
  startAppWithEveryKindOfItemApplied,
  startAppWithHandWrittenAgentConfig,
  startAppWithHandWrittenConfigAndAnAppliedSetup,
} from "../support/setup/config-fixtures.ts";
import { environment, permissionRule } from "../support/setup/config-items.ts";

afterEach(cleanUpAfterTest);

test("an item removed in the app is removed from the agents' files, and the user's own entries stay", async () => {
  // ********************************************************************
  // ** GIVEN hand-written config and a setup the app has applied on top of it
  // ********************************************************************
  const app = await startAppWithHandWrittenConfigAndAnAppliedSetup();

  // ********************************************************************
  // ** WHEN the user removes every item in the app and applies again
  // ********************************************************************
  await app.user.setsUp([]);
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN everything the app wrote is gone, files included
  // ********************************************************************
  await expectManagedEntriesToBeGone(app.home);
  // AND everything the user wrote by hand is still there
  await expectHandWrittenConfigToBeKept(app.home);
});

test("a permission mode and an environment variable are written for both agents", async () => {
  // ********************************************************************
  // ** GIVEN hand-written config for both agents
  // ********************************************************************
  const app = await startAppWithHandWrittenAgentConfig();
  // AND the user has set up the auto-edit mode and the variable GREETING=hello
  await app.user.setsUp([
    permissionRule({ allow: [], deny: [], mode: "auto-edit" }),
    environment({ GREETING: "hello" }),
  ]);

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN Claude Code and Codex both run in auto-edit mode and know the variable
  // ********************************************************************
  await expectModeAndVariableInBothAgents(app.home);
});

test("removing every item leaves no empty sections behind in the agents' files", async () => {
  // ********************************************************************
  // ** GIVEN every kind of item set up in the app and applied to both agents
  // ********************************************************************
  const app = await startAppWithEveryKindOfItemApplied();

  // ********************************************************************
  // ** WHEN the user removes every item and applies again
  // ********************************************************************
  await app.user.setsUp([]);
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN Claude Code's files hold no leftover empty sections
  // ********************************************************************
  await expectNoLeftoverSections(app.home);
});
