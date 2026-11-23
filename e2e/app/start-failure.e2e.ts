import { afterEach, test } from "bun:test";
import { expectAppToHaveRefusedToStart } from "../support/expect/app-outage-expectations.ts";
import { triesToStartTheAppWithoutItsDefaultUi } from "../support/setup/app-start-failure.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test("the app refuses to start, and lets go of its connections, when its default UI is missing", async () => {
  // ********************************************************************
  // ** GIVEN a default UI that is not where the app expects it
  // ********************************************************************
  // (the helper starts the app with a template folder that does not exist)

  // ********************************************************************
  // ** WHEN the app is started
  // ********************************************************************
  const outcome = await triesToStartTheAppWithoutItsDefaultUi();

  // ********************************************************************
  // ** THEN it does not start, and says why
  // ********************************************************************
  expectAppToHaveRefusedToStart(outcome);
});
