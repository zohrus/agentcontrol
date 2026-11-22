import { afterEach, test } from "bun:test";
import {
  expectChangedFilesToInclude,
  expectModifySessionListedAsDirectory,
  expectNoChangeInProgress,
  expectUiChangeReadyToKeep,
  expectUiVersionKept,
} from "../support/expect/modify-expectations.ts";
import {
  expectLiveUiFileNotToContain,
  expectLiveUiFileToContain,
  expectStagingUiFileToContain,
} from "../support/expect/ui-file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith } from "../support/setup/fixture-ui.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

const withCost = sessionTableWith("Title", "Status", "Cost");

test("a change the Modify agent makes is checked, put into the live UI and waits for Keep", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with its default UI
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  // AND the Modify agent will add a cost column
  app.mockAgent.willWriteFile("src/session-table.ts", withCost);

  // ********************************************************************
  // ** WHEN the user asks to add a cost column
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");

  // ********************************************************************
  // ** THEN the change passed the checks and is in the live UI, waiting for Keep
  // ********************************************************************
  const state = await expectUiChangeReadyToKeep(app);
  await expectLiveUiFileToContain(app, { path: "src/session-table.ts", text: '"Cost"' });
  // AND the changed file is listed
  expectChangedFilesToInclude(state, "src/session-table.ts");
});

test("Keep records a version whose message is the user's request", async () => {
  // ********************************************************************
  // ** GIVEN a cost column change that is waiting for Keep
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile("src/session-table.ts", withCost);
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** WHEN the user presses Keep
  // ********************************************************************
  await app.user.keepsTheChange();

  // ********************************************************************
  // ** THEN the newest version is that change, named after the request
  // ********************************************************************
  await expectUiVersionKept(app, { request: "add a cost column" });
  // AND nothing waits any more
  await expectNoChangeInProgress(app);
});

test("Undo brings the previous UI back in the live and the staging folder", async () => {
  // ********************************************************************
  // ** GIVEN a cost column change that is waiting for Keep
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile("src/session-table.ts", withCost);
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** WHEN the user presses Undo
  // ********************************************************************
  await app.user.undoesTheChange();

  // ********************************************************************
  // ** THEN the live UI has no cost column any more
  // ********************************************************************
  await expectNoChangeInProgress(app);
  await expectLiveUiFileNotToContain(app, { path: "src/session-table.ts", text: "Cost" });
  // AND neither does the staging folder, so the next request starts clean
  await expectStagingUiFileToContain(app, { path: "src/session-table.ts", text: '"Status"]' });
});

test("the Modify agent's session is listed as a directory session", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with its default UI
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile("src/session-table.ts", withCost);

  // ********************************************************************
  // ** WHEN the user asks to add a cost column
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** THEN the agent's session has kind "directory", not a worktree
  // ********************************************************************
  await expectModifySessionListedAsDirectory(app);
});
