import { afterEach, test } from "bun:test";
import {
  expectFailureExplained,
  expectModifyAgentPromptedTimes,
  expectModifyAgentToldAbout,
  expectUiChangeFailed,
  expectUiChangeReadyToKeep,
} from "../support/expect/modify-expectations.ts";
import {
  expectLiveUiFileNotToContain,
  expectLiveUiFileToContain,
} from "../support/expect/ui-file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith, sessionTableWithTypeError } from "../support/setup/fixture-ui.ts";
import { modifyAgentKeepsWritingTypeErrors } from "../support/setup/modify-history.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

const table = "src/session-table.ts";
const wrongType = sessionTableWithTypeError;
const fixed = sessionTableWith("Title", "Status", "Cost");

test("an edit with a type error is sent back with the compiler message and the fix is promoted", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent first writes a type error, then fixes it
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile(table, wrongType);
  app.mockAgent.onNextPrompt();
  app.mockAgent.willWriteFile(table, fixed);

  // ********************************************************************
  // ** WHEN the user asks to add a cost column
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");

  // ********************************************************************
  // ** THEN the fixed version is in the live UI, waiting for Keep
  // ********************************************************************
  await expectUiChangeReadyToKeep(app);
  await expectLiveUiFileToContain(app, { path: table, text: '"Cost"' });
  // AND the agent was told what the compiler said
  await expectModifyAgentToldAbout(app, "error TS2322");
});

test("after three failed fixes the live UI is unchanged and the change has failed", async () => {
  // ********************************************************************
  // ** GIVEN the Modify agent writes a type error in every turn
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  modifyAgentKeepsWritingTypeErrors(app, 3);

  // ********************************************************************
  // ** WHEN the user asks to add a cost column
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");

  // ********************************************************************
  // ** THEN the change has failed, in words, with the compiler output
  // ********************************************************************
  expectFailureExplained(await expectUiChangeFailed(app), "TS2322");
  // AND the agent got the original request and three rounds of errors
  await expectModifyAgentPromptedTimes(app, 4);
  // AND the live UI is unchanged
  await expectLiveUiFileNotToContain(app, { path: table, text: "[1]" });
});
