import { afterEach, test } from "bun:test";
import {
  expectScriptToRefuseSaying,
  expectScriptToSucceedSaying,
} from "../support/expect/landing-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  commitsFile,
  createProjectWithOrigin,
  mainGainsADependency,
  runsTheDependencyGuard,
  stagesADependencyOnTheBranch,
  startsMergingMainIntoTheBranch,
} from "../support/setup/landing-project.ts";

afterEach(cleanUpAfterTest);

test("the dependency guard lets through a dependency that only comes from merging main", async () => {
  // ********************************************************************
  // ** GIVEN main gained a dependency after the branch was made, and the branch is merging main
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await commitsFile(project, { branch: "feature", file: "a.txt", text: "feature\n" });
  await mainGainsADependency(project);
  await startsMergingMainIntoTheBranch(project, "feature");

  // ********************************************************************
  // ** WHEN the merge is committed and the guard runs
  // ********************************************************************
  const ran = await runsTheDependencyGuard(project);

  // ********************************************************************
  // ** THEN the guard lets it through
  // ********************************************************************
  expectScriptToSucceedSaying(ran, "");
});

test("the dependency guard still blocks a dependency the branch adds itself", async () => {
  // ********************************************************************
  // ** GIVEN a branch that adds a dependency to package.json and stages it
  // ********************************************************************
  const project = await createProjectWithOrigin();
  await commitsFile(project, { branch: "feature", file: "a.txt", text: "feature\n" });
  await stagesADependencyOnTheBranch(project, "feature");

  // ********************************************************************
  // ** WHEN the guard runs
  // ********************************************************************
  const ran = await runsTheDependencyGuard(project);

  // ********************************************************************
  // ** THEN it blocks the commit, naming package.json
  // ********************************************************************
  expectScriptToRefuseSaying(ran, "package.json");
});
