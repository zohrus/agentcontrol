import { afterEach, test } from "bun:test";
import {
  expectNoChangeInProgress,
  expectUiChangeFailed,
  expectUiChangeReadyToKeep,
} from "../support/expect/modify-expectations.ts";
import {
  expectLiveUiFileNotToContain,
  expectLiveUiFileToContain,
  expectStagingUiFileToContain,
} from "../support/expect/ui-file-expectations.ts";
import { expectKeptOnce } from "../support/expect/modify-more-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith, sessionTableWithTypeError } from "../support/setup/fixture-ui.ts";
import { userKeptTableColumns } from "../support/setup/modify-history.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

const table = "src/session-table.ts";

test("Undo with nothing waiting goes back one kept version", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a change that added a Cost column
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  await userKeptTableColumns(app, ["Title", "Cost"]);

  // ********************************************************************
  // ** WHEN the user presses Undo
  // ********************************************************************
  await app.user.undoesTheChange();

  // ********************************************************************
  // ** THEN the live UI is back to the default table
  // ********************************************************************
  await expectLiveUiFileNotToContain(app, { path: table, text: "Cost" });
});

test("restoring an earlier version brings its files back", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a Cost column and then a Branch column
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  await userKeptTableColumns(app, ["Title", "Cost"]);
  await userKeptTableColumns(app, ["Title", "Branch"]);
  const versions = await app.user.readsUiVersions();

  // ********************************************************************
  // ** WHEN the user restores the version that added the Cost column
  // ********************************************************************
  await app.user.restoresUiVersion(versions[1]?.commit ?? "");

  // ********************************************************************
  // ** THEN the live UI has the Cost column again
  // ********************************************************************
  await expectLiveUiFileToContain(app, { path: table, text: '"Cost"' });
});

test("discarding a failed attempt leaves the live UI and a clean staging folder", async () => {
  // ********************************************************************
  // ** GIVEN a request whose change never passes the checks
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile(table, sessionTableWithTypeError);
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeFailed(app);

  // ********************************************************************
  // ** WHEN the user discards the attempt
  // ********************************************************************
  await app.user.discardsTheChange();

  // ********************************************************************
  // ** THEN nothing is in progress and staging is the live UI again
  // ********************************************************************
  await expectNoChangeInProgress(app);
  await expectStagingUiFileToContain(app, { path: table, text: '"Status"]' });
});

test("a change that waits for Keep is still waiting after the app restarts", async () => {
  // ********************************************************************
  // ** GIVEN a cost column change that is waiting for Keep
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile(table, sessionTableWith("Title", "Cost"));
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** WHEN the app quits and starts again
  // ********************************************************************
  await app.restartsTheApp();

  // ********************************************************************
  // ** THEN the change still waits, and Keep records it with the request
  // ********************************************************************
  await expectUiChangeReadyToKeep(app);
  await app.user.keepsTheChange();
  await expectNoChangeInProgress(app);
});

test("pressing Keep twice at once keeps the change once", async () => {
  // ********************************************************************
  // ** GIVEN a cost column change that is waiting for Keep
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  app.mockAgent.willWriteFile(table, sessionTableWith("Title", "Cost"));
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** WHEN the user double-clicks Keep
  // ********************************************************************
  await app.user.pressesKeepTwiceAtOnce();

  // ********************************************************************
  // ** THEN the change is recorded as one version
  // ********************************************************************
  await expectKeptOnce(app, "add a cost column");
});
