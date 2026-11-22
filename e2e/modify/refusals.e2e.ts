import { afterEach, test } from "bun:test";
import { expectUiChangeReadyToKeep } from "../support/expect/modify-expectations.ts";
import { expectRefusedAs } from "../support/expect/modify-more-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith } from "../support/setup/fixture-ui.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

test("a blank request is refused as invalid", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with its default UI
  // ********************************************************************
  const app = await startAppWithModifiableUi();

  // ********************************************************************
  // ** WHEN the user sends a request with only spaces
  // ********************************************************************
  const attempt = app.user.asksToModifyTheUi("   ");

  // ********************************************************************
  // ** THEN the app refuses it as an invalid request
  // ********************************************************************
  await expectRefusedAs(attempt, "invalid-request");
});

test("a second request is refused while a change waits for Keep or Undo", async () => {
  // ********************************************************************
  // ** GIVEN a change that is waiting for Keep
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile("src/session-table.ts", sessionTableWith("Title", "Cost"));
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** WHEN the user asks for another change
  // ********************************************************************
  const attempt = app.user.asksToModifyTheUi("make it blue");

  // ********************************************************************
  // ** THEN the app says to keep or undo the waiting change first
  // ********************************************************************
  await expectRefusedAs(attempt, "modify-busy");
});

test("restoring a version is refused while a change waits for Keep or Undo", async () => {
  // ********************************************************************
  // ** GIVEN a change that is waiting for Keep
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile("src/session-table.ts", sessionTableWith("Title", "Cost"));
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);
  const [first] = await app.user.readsUiVersions();

  // ********************************************************************
  // ** WHEN the user restores a version
  // ********************************************************************
  const attempt = app.user.restoresUiVersion(first?.commit ?? "");

  // ********************************************************************
  // ** THEN the app refuses until the change is kept or undone
  // ********************************************************************
  await expectRefusedAs(attempt, "modify-busy");
});

test("Keep with nothing waiting is refused", async () => {
  // ********************************************************************
  // ** GIVEN the app is running and no change was asked for
  // ********************************************************************
  const app = await startAppWithModifiableUi();

  // ********************************************************************
  // ** WHEN the user presses Keep
  // ********************************************************************
  const attempt = app.user.keepsTheChange();

  // ********************************************************************
  // ** THEN the app says there is nothing to keep
  // ********************************************************************
  await expectRefusedAs(attempt, "nothing-to-keep");
});

test("Undo and Discard with nothing to undo are refused", async () => {
  // ********************************************************************
  // ** GIVEN the app is running on its untouched default UI
  // ********************************************************************
  const app = await startAppWithModifiableUi();

  // ********************************************************************
  // ** WHEN the user presses Undo
  // ********************************************************************
  const undo = app.user.undoesTheChange();

  // ********************************************************************
  // ** THEN the app says there is nothing to undo
  // ********************************************************************
  await expectRefusedAs(undo, "nothing-to-undo");
  // AND Discard says there is nothing to discard
  await expectRefusedAs(app.user.discardsTheChange(), "nothing-to-discard");
});
