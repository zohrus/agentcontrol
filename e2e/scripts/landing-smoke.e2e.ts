import { afterEach, test } from "bun:test";
import {
  expectMainToHold,
  expectMainToLack,
  expectOutputInOrder,
  expectScriptToRefuseSaying,
  expectScriptToSucceedSaying,
} from "../support/expect/landing-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { mainsSmokeTestFails } from "../support/setup/landing-smoke.ts";
import {
  commitsFile,
  createProjectWithOrigin,
  integrates,
  publishesMain,
} from "../support/setup/landing-project.ts";

afterEach(cleanUpAfterTest);

test("a code change is smoke-tested on the compiled app after the check and before it lands", async () => {
  // ********************************************************************
  // ** GIVEN a branch that changes a source file
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await commitsFile(project, { branch: "feature", file: "src/a.ts", text: "export {};\n" });

  // ********************************************************************
  // ** WHEN the branch is integrated
  // ********************************************************************
  const ran = await integrates(project, "feature");

  // ********************************************************************
  // ** THEN the Linux app is built and its smoke test run, and only then main moves
  // ********************************************************************
  expectScriptToSucceedSaying(ran, "pushed to origin/main");
  expectOutputInOrder(ran, [
    "building-the-linux-app",
    "smoke-of-the-app --app dist/release/linux-x64",
    "pushed to origin/main",
  ]);
  await expectMainToHold(project, { file: "src/a.ts", text: "export {};\n" });
});

test("a failing smoke test stops the landing", async () => {
  // ********************************************************************
  // ** GIVEN a smoke test that fails on main, and a branch that changes a source file
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await mainsSmokeTestFails(project);
  await commitsFile(project, { branch: "feature", file: "src/a.ts", text: "export {};\n" });

  // ********************************************************************
  // ** WHEN the branch is integrated
  // ********************************************************************
  const ran = await integrates(project, "feature");

  // ********************************************************************
  // ** THEN the script refuses and nothing of the branch lands
  // ********************************************************************
  expectScriptToRefuseSaying(ran, "the compiled-app smoke failed");
  await expectMainToLack(project, "src/a.ts");
});

test("a change to documentation only lands without the smoke test, which would fail", async () => {
  // ********************************************************************
  // ** GIVEN a smoke test that fails on main, and a branch that changes only docs and Markdown
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await mainsSmokeTestFails(project);
  await commitsFile(project, { branch: "feature", file: "docs/plan.html", text: "<p>plan</p>\n" });
  await commitsFile(project, { branch: "feature", file: "NOTES.md", text: "notes\n" });
  await publishesMain(project);

  // ********************************************************************
  // ** WHEN the branch is integrated
  // ********************************************************************
  const ran = await integrates(project, "feature");

  // ********************************************************************
  // ** THEN it lands, saying the smoke test was skipped
  // ********************************************************************
  expectScriptToSucceedSaying(ran, "only documentation changed, skipping the compiled-app smoke");
  await expectMainToHold(project, { file: "NOTES.md", text: "notes\n" });
});

test("--skip-smoke is refused for a change to source files", async () => {
  // ********************************************************************
  // ** GIVEN a branch that changes a source file
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await commitsFile(project, { branch: "feature", file: "src/a.ts", text: "export {};\n" });

  // ********************************************************************
  // ** WHEN the branch is integrated with --skip-smoke
  // ********************************************************************
  const ran = await integrates(project, "feature", ["--skip-smoke"]);

  // ********************************************************************
  // ** THEN the script refuses, naming what the flag is for, and nothing lands
  // ********************************************************************
  expectScriptToRefuseSaying(ran, "--skip-smoke is only for changes to docs/ and Markdown files");
  await expectMainToLack(project, "src/a.ts");
});
