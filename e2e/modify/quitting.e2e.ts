import { afterEach, test } from "bun:test";
import {
  expectNoChangeInProgress,
  expectNoModifyAgentLeftRunning,
} from "../support/expect/modify-expectations.ts";
import { expectModifyAgentWorking } from "../support/expect/modify-more-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { userKeptButTheAppDiedBeforeForgettingTheWaitingChange } from "../support/setup/modify-history.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

test("quitting the app ends the Modify agent's session, so no agent is left running", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent is working on a turn that does not end by itself
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWaitUntilCancelled();
  await app.user.asksToModifyTheUi("add a cost column");
  await expectModifyAgentWorking(app);

  // ********************************************************************
  // ** WHEN the user quits the app
  // ********************************************************************
  await app.restartsTheApp();

  // ********************************************************************
  // ** THEN the relay no longer has a Modify agent session running
  // ********************************************************************
  await expectNoModifyAgentLeftRunning(await app.readsTheRelaySessions());
});

test("a change kept just before the app died is not offered for Keep again after the restart", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a change, but the app died before it forgot the change was waiting
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  await userKeptButTheAppDiedBeforeForgettingTheWaitingChange(app);

  // ********************************************************************
  // ** WHEN the app starts again
  // ********************************************************************
  await app.restartsTheApp();

  // ********************************************************************
  // ** THEN nothing is waiting for Keep
  // ********************************************************************
  await expectNoChangeInProgress(app);
});
