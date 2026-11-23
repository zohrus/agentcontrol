import { afterEach, test } from "bun:test";
import {
  expectUiChangeReadyToKeep,
  expectUpdateSummary,
} from "../support/expect/modify-expectations.ts";
import { expectLiveUiFileToContain } from "../support/expect/ui-file-expectations.ts";
import { expectUpdateKept } from "../support/expect/modify-more-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith } from "../support/setup/fixture-ui.ts";
import {
  userKeptCostColumnAndFooter,
  userKeptTableColumns,
} from "../support/setup/modify-history.ts";
import { releaseDefaultUiUpdate, startAppWithModifiableUi } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

const table = "src/session-table.ts";
const branchTable = sessionTableWith("Title", "Branch", "Status");

test("a default UI update that merges cleanly keeps the user's change", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a cost column change
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  await userKeptTableColumns(app, ["Title", "Status", "Cost"]);
  // AND default UI 1.1 is released, changing only the footer
  await releaseDefaultUiUpdate(app, {
    version: "1.1",
    files: { "src/footer.ts": 'export const footer = "AgentControl 1.1";\n' },
  });

  // ********************************************************************
  // ** WHEN the user applies the update
  // ********************************************************************
  await app.user.appliesTheDefaultUiUpdate();

  // ********************************************************************
  // ** THEN the live UI has the new footer and still the cost column
  // ********************************************************************
  await expectUiChangeReadyToKeep(app);
  await expectLiveUiFileToContain(app, { path: "src/footer.ts", text: "AgentControl 1.1" });
  await expectLiveUiFileToContain(app, { path: table, text: '"Cost"' });
  // AND the summary names the update
  await expectUpdateSummary(app, "Update 1.1");
});

test("a conflicting update is resolved by the Modify agent and both changes survive", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a cost column change
  // ********************************************************************
  const app = await startAppWithModifiableUi();
  await userKeptCostColumnAndFooter(app);
  // AND default UI 1.1 is released, adding a branch column on the same line
  await releaseDefaultUiUpdate(app, { version: "1.1", files: { [table]: branchTable } });
  // AND the Modify agent will resolve the conflict keeping both columns
  app.mockAgent.startsNewScript();
  app.mockAgent.willWriteFile(table, sessionTableWith("Title", "Branch", "Status", "Cost"));

  // ********************************************************************
  // ** WHEN the user applies the update
  // ********************************************************************
  await app.user.appliesTheDefaultUiUpdate();

  // ********************************************************************
  // ** THEN the live UI has the new branch column and the user's cost column
  // ********************************************************************
  await expectUiChangeReadyToKeep(app);
  await expectLiveUiFileToContain(app, { path: table, text: '"Branch", "Status", "Cost"' });
  // AND the summary says one change was kept automatically and one conflict resolved
  await expectUpdateSummary(app, "1 of your changes kept automatically, 1 conflict resolved");
  // AND Keep records the update as a version
  await app.user.keepsTheChange();
  await expectUpdateKept(app, "1.1");
});
