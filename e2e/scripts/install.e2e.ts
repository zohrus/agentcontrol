import { afterEach, test } from "bun:test";
import { expectNoFileToChangeMode } from "../support/expect/repo-tree-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  installsTheDependencies,
  readsTheModesOfTheTrackedFiles,
} from "../support/setup/repo-tree.ts";

afterEach(cleanUpAfterTest);

test("installing the dependencies does not change the mode of any file in the repo", async () => {
  // ********************************************************************
  // ** GIVEN the repo as checked out
  // ********************************************************************
  const before = await readsTheModesOfTheTrackedFiles();

  // ********************************************************************
  // ** WHEN the dependencies are installed
  // ********************************************************************
  await installsTheDependencies();

  // ********************************************************************
  // ** THEN no file became executable (or stopped being so): the tree stays clean
  // ********************************************************************
  expectNoFileToChangeMode(before, await readsTheModesOfTheTrackedFiles());
});
