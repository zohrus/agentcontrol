import { afterEach, test } from "bun:test";
import { expectSafePageToList } from "../support/expect/modify-expectations.ts";
import { expectLiveUiFileToContain } from "../support/expect/ui-file-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { userKeptTableColumns } from "../support/setup/modify-history.ts";
import { startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

test("the recovery page lists versions and restores one even when the live UI folder is gone", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a cost column change
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  await userKeptTableColumns(app, ["Title", "Cost"]);
  // AND the live UI folder has been deleted
  await app.user.deletesTheLiveUiFolder();

  // ********************************************************************
  // ** WHEN the user opens the recovery page
  // ********************************************************************
  const page = await app.user.opensTheSafePage();

  // ********************************************************************
  // ** THEN it lists the kept version with a Restore button
  // ********************************************************************
  expectSafePageToList(page, "show Title, Cost");

  // ********************************************************************
  // ** WHEN the user presses Restore on that version
  // ********************************************************************
  await app.user.pressesRestoreOnTheSafePage(page, "show Title, Cost");

  // ********************************************************************
  // ** THEN the live UI is back, with the cost column
  // ********************************************************************
  await expectLiveUiFileToContain(app, { path: "src/session-table.ts", text: '"Cost"' });
});
