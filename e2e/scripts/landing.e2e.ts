import { afterEach, test } from "bun:test";
import {
  expectMainToHold,
  expectMainToLack,
  expectScriptToRefuseSaying,
  expectScriptToSucceedSaying,
} from "../support/expect/landing-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  branchAndMainBothChangedSharedFile,
  commitsFile,
  createProjectWithOrigin,
  integrates,
  mergesMainIntoTheBranch,
  publishesMain,
} from "../support/setup/landing-project.ts";

afterEach(cleanUpAfterTest);

test("a branch that merged main in, settling a conflict, lands as the merge it is", async () => {
  // ********************************************************************
  // ** GIVEN a branch and main that both changed shared.txt, and main was merged into the branch
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await branchAndMainBothChangedSharedFile(project);
  await mergesMainIntoTheBranch(project, "feature");

  // ********************************************************************
  // ** WHEN the branch is integrated
  // ********************************************************************
  const ran = await integrates(project, "feature");

  // ********************************************************************
  // ** THEN it is checked as it is, not rebased, and main now holds the settled file
  // ********************************************************************
  expectScriptToSucceedSaying(ran, "already contains origin/main");
  await expectMainToHold(project, { file: "shared.txt", text: "main and feature together\n" });
});

test("a branch behind main is rebased onto it, and a dry run pushes nothing", async () => {
  // ********************************************************************
  // ** GIVEN a branch that changed a.txt while main moved on by changing b.txt
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await commitsFile(project, { branch: "feature", file: "a.txt", text: "feature\n" });
  await commitsFile(project, { branch: "main", file: "b.txt", text: "main\n" });
  await publishesMain(project);

  // ********************************************************************
  // ** WHEN the branch is integrated with --dry-run
  // ********************************************************************
  const ran = await integrates(project, "feature", ["--dry-run"]);

  // ********************************************************************
  // ** THEN the check passes on the rebased branch and origin's main is untouched
  // ********************************************************************
  expectScriptToSucceedSaying(ran, "--dry-run, not pushing");
  await expectMainToLack(project, "a.txt");
});

test("a branch that conflicts with main and did not merge it is refused with the files", async () => {
  // ********************************************************************
  // ** GIVEN a branch and main that both changed shared.txt, with main not merged into the branch
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await branchAndMainBothChangedSharedFile(project);

  // ********************************************************************
  // ** WHEN the branch is integrated
  // ********************************************************************
  const ran = await integrates(project, "feature");

  // ********************************************************************
  // ** THEN it is refused, naming shared.txt
  // ********************************************************************
  expectScriptToRefuseSaying(ran, "shared.txt");
});
