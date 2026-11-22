import { afterEach, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { expectInstructionBesideNotes } from "../support/expect/config-agent-expectations.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import { instructions } from "../support/setup/config-items.ts";

afterEach(cleanUpAfterTest);

test("instructions land in CLAUDE.md and AGENTS.md inside managed markers, next to the user's notes", async () => {
  // ********************************************************************
  // ** GIVEN a Claude Code and a Codex instructions file where the user wrote their own notes
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.home.has(".claude/CLAUDE.md", "My own Claude notes\n");
  await app.home.has(".codex/AGENTS.md", "My own Codex notes\n");
  // AND the user has set up the instruction "Always write tests first."
  await app.user.setsUp([instructions({ id: "team-rules", text: "Always write tests first." })]);

  // ********************************************************************
  // ** WHEN the user reviews the plan and applies it
  // ********************************************************************
  await app.user.reviewsAndAppliesThePlan();

  // ********************************************************************
  // ** THEN CLAUDE.md holds the instruction between markers and still the user's notes
  // ********************************************************************
  const claude = { file: ".claude/CLAUDE.md", notes: "My own Claude notes\n" };
  await expectInstructionBesideNotes(app.home, claude);
  // AND AGENTS.md holds it between the same markers and still the user's notes
  await expectInstructionBesideNotes(app.home, {
    file: ".codex/AGENTS.md",
    notes: "My own Codex notes\n",
  });
});
