import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  expectEveryKindOfItemToBeImported,
  expectInstructionBesideNotes,
} from "../support/expect/config-agent-expectations.ts";
import {
  expectFileNotToContain,
  expectPlanToChangeFiles,
  expectUserFilesToBeUnchanged,
} from "../support/expect/config-expectations.ts";
import {
  startAppWithEveryKindOfItemApplied,
  startAppWithHandWrittenHooksNotesAndServer,
  startAppWithNotesBesideAnAppliedInstruction,
} from "../support/setup/config-fixtures.ts";
import { withNotesRewritten } from "../support/setup/config-items.ts";

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

test("applying an imported hand-written setup leaves every file exactly as it was", async () => {
  // ********************************************************************
  // ** GIVEN hand-written Claude Code hooks (one with two commands), notes and an MCP server
  // ********************************************************************
  const app = await startAppWithHandWrittenHooksNotesAndServer();
  const filesBefore = await app.home.snapshot();
  // AND the user imported them and kept them as items in the app
  await app.user.setsUp(await app.user.importsTheExistingSetup({ onlyForClaudeCode: true }));

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  const plan = await app.user.reviewsAndAppliesThePlan({ onlyForClaudeCode: true });

  // ********************************************************************
  // ** THEN the plan changes no file, and every file is byte for byte as it was
  // ********************************************************************
  expectPlanToChangeFiles(plan.plan, 0);
  expectUserFilesToBeUnchanged({ before: filesBefore, after: await app.home.snapshot() });
});

test("rewriting imported hand-written notes replaces them and keeps the managed instruction", async () => {
  // ********************************************************************
  // ** GIVEN hand-written notes in CLAUDE.md beside an instruction the app applied
  // ********************************************************************
  const app = await startAppWithNotesBesideAnAppliedInstruction();
  // AND the user imported both and rewrote the notes in the app
  const imported = await app.user.importsTheExistingSetup({ onlyForClaudeCode: true });
  await app.user.setsUp(withNotesRewritten(imported, "New notes."));

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan({ onlyForClaudeCode: true });

  // ********************************************************************
  // ** THEN CLAUDE.md has the new notes beside the instruction, and the old notes are gone
  // ********************************************************************
  const file = ".claude/CLAUDE.md";
  await expectInstructionBesideNotes(app.home, { file, notes: "New notes." });
  await expectFileNotToContain(app.home, { file, text: "Old notes." });
});
