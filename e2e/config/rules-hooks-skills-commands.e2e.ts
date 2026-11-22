import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  expectClaudeCodeToHaveRulesHookSkillAndCommand,
  expectCodexToHaveHookAndSkill,
} from "./support/expect/agent-expectations.ts";
import {
  expectItemSupported,
  expectItemUnsupported,
} from "./support/expect/config-expectations.ts";
import { startAppWithRuleHookSkillAndCommand } from "./support/setup/config-fixtures.ts";

afterEach(cleanUpAfterTest);

test("a permission rule, a hook, a skill and a command are written for the agents that support them", async () => {
  // ********************************************************************
  // ** GIVEN the user has set up a permission rule, a hook, a skill and a command
  // ********************************************************************
  const app = await startAppWithRuleHookSkillAndCommand();

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN Claude Code has the rules, the hook, the skill folder and the command file
  // ********************************************************************
  await expectClaudeCodeToHaveRulesHookSkillAndCommand(app.home);
  // AND Codex has the hook and the skill, which it supports
  await expectCodexToHaveHookAndSkill(app.home);
});

test("what an agent cannot take is reported as unsupported with the reason", async () => {
  // ********************************************************************
  // ** GIVEN the user has set up a permission rule, a hook, a skill and a command
  // ********************************************************************
  const app = await startAppWithRuleHookSkillAndCommand();

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan says Codex cannot take the allow and deny rules, and why
  // ********************************************************************
  const rules = { agent: "codex", itemId: "rules", reasonIncludes: "no allow or deny list" };
  expectItemUnsupported(plan, rules);
  // AND the plan says Codex cannot take the command, and why
  const ship = { agent: "codex", itemId: "command-ship", reasonIncludes: "custom prompt" };
  expectItemUnsupported(plan, ship);
  // AND the plan has no complaint about Claude Code
  expectItemSupported(plan, { agent: "claude-code", itemId: "rules" });
  expectItemSupported(plan, { agent: "claude-code", itemId: "command-ship" });
});
