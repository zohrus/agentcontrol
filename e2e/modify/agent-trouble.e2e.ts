import { afterEach, test } from "bun:test";
import {
  expectModifyAgentPromptedTimes,
  expectNoChangeInProgress,
  expectUiChangeFailed,
  expectUiChangeReadyToKeep,
} from "../support/expect/modify-expectations.ts";
import {
  expectFailureToSay,
  expectModifyAgentWorking,
  expectSameModifySession,
} from "../support/expect/modify-more-expectations.ts";
import { expectLiveUiFileToContain } from "../support/expect/ui-file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith } from "../support/setup/fixture-ui.ts";
import {
  deleteTheUiHistory,
  releaseDefaultUiUpdate,
  startAppWithModifiableUi,
} from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

const table = "src/session-table.ts";
const newFooter = 'export const footer = "AgentControl 1.1";\n';

test("a Modify agent that dies mid-turn ends the attempt with a plain message", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent will crash during its turn
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willExitUnexpectedly();

  // ********************************************************************
  // ** WHEN the user asks for a change
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");

  // ********************************************************************
  // ** THEN the attempt failed and says the agent stopped
  // ********************************************************************
  await expectUiChangeFailed(app);
  await expectFailureToSay(app, "stopped before it finished");
});

test("a Modify agent that refuses to continue ends the attempt", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent will end its turn with a refusal
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willFinishWith("refusal");

  // ********************************************************************
  // ** WHEN the user asks for a change
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");

  // ********************************************************************
  // ** THEN the attempt failed and says why
  // ********************************************************************
  await expectUiChangeFailed(app);
  await expectFailureToSay(app, "stopped early (refusal)");
});

test("a message after a failed attempt continues the same Modify session", async () => {
  // ********************************************************************
  // ** GIVEN a first attempt in which the agent changed nothing
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willReply("I did not find where to put it.");
  app.mockAgent.onNextPrompt();
  app.mockAgent.willWriteFile(table, sessionTableWith("Title", "Cost"));
  await app.user.asksToModifyTheUi("add a cost column");
  const failed = await expectUiChangeFailed(app);

  // ********************************************************************
  // ** WHEN the user sends another message
  // ********************************************************************
  await app.user.asksToModifyTheUi("put it in the table");

  // ********************************************************************
  // ** THEN the same session carries on and the change is ready
  // ********************************************************************
  await expectUiChangeReadyToKeep(app);
  await expectSameModifySession(app, failed.sessionId);
  await expectModifyAgentPromptedTimes(app, 2);
  await expectLiveUiFileToContain(app, { path: table, text: '"Cost"' });
});

test("discarding while the Modify agent is working stops it", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent works on a turn that does not end by itself
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWaitUntilCancelled();
  await app.user.asksToModifyTheUi("add a cost column");
  await expectModifyAgentWorking(app);

  // ********************************************************************
  // ** WHEN the user discards the attempt
  // ********************************************************************
  await app.user.discardsTheChange();

  // ********************************************************************
  // ** THEN nothing is in progress any more
  // ********************************************************************
  await expectNoChangeInProgress(app);
});

test("an update that cannot be merged fails with a plain message and keeps the live UI", async () => {
  // ********************************************************************
  // ** GIVEN default UI 1.1 is available but the version history is gone
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  await releaseDefaultUiUpdate(app, { version: "1.1", files: { "src/footer.ts": newFooter } });
  await deleteTheUiHistory(app);

  // ********************************************************************
  // ** WHEN the user applies the update
  // ********************************************************************
  await app.user.appliesTheDefaultUiUpdate();

  // ********************************************************************
  // ** THEN the update failed in words and the live UI is untouched
  // ********************************************************************
  await expectUiChangeFailed(app);
  await expectFailureToSay(app, "Something went wrong");
});
