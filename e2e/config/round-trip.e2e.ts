import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { expectEveryKindOfItemToBeImported } from "./support/expect/agent-expectations.ts";
import { expectFileToContainOnce } from "./support/expect/config-expectations.ts";
import {
  startAppWithEveryKindOfItemApplied,
  startAppWithHandWrittenHookAndNotes,
} from "./support/setup/config-fixtures.ts";

afterEach(cleanUpAfterTest);

test("importing what the app itself applied returns every kind of item again", async () => {
  // ********************************************************************
  // ** GIVEN every kind of item set up in the app and applied to both agents
  // ********************************************************************
  const app = await startAppWithEveryKindOfItemApplied();

  // ********************************************************************
  // ** WHEN the user imports the existing setup
  // ********************************************************************
  const items = await app.user.importsTheExistingSetup();

  // ********************************************************************
  // ** THEN every kind of item comes back, the hook and instruction under the ids the app gave them
  // ********************************************************************
  expectEveryKindOfItemToBeImported(items);
});

test("applying an imported hand-written setup does not duplicate it", async () => {
  // ********************************************************************
  // ** GIVEN a hand-written Claude Code hook and notes
  // ********************************************************************
  const app = await startAppWithHandWrittenHookAndNotes();
  // AND the user imported them and kept them as items in the app
  await app.user.setsUp(await app.user.importsTheExistingSetup());

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN the hook is in the settings once, and the notes are in CLAUDE.md once
  // ********************************************************************
  await expectFileToContainOnce(app.home, { file: ".claude/settings.json", text: "echo done" });
  await expectFileToContainOnce(app.home, {
    file: ".claude/CLAUDE.md",
    text: "Be kind to reviewers.",
  });
});
