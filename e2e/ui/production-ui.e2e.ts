import { afterEach, test } from "bun:test";
import {
  expectNoChangeInProgress,
  expectUiChangeReadyToKeep,
} from "../support/expect/modify-expectations.ts";
import {
  expectTheAppToServeABuiltUi,
  expectThePageToCarryNoBuildNotice,
  expectTheServedUiNotToShow,
  expectTheServedUiToShow,
  expectTheShippedBuildToBeServedAtOnce,
} from "../support/expect/production-ui-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith } from "../support/setup/fixture-ui.ts";
import { userKeptTableColumns } from "../support/setup/modify-history.ts";
import {
  aCostColumnWasKeptAndDefaultUiOnePointOneIsReleased,
  SHIPPED_BUILD_MARKER,
  startsAppLikeARelease,
  startsAppLikeAReleaseThatShipsTheUiBuilt,
  userRestoresTheFirstUiVersion,
} from "../support/setup/production-ui.ts";

afterEach(cleanUpAfterTest);

const withCost = sessionTableWith("Title", "Status", "Cost");

test("a released app serves a build of the UI, not the UI's source modules", async () => {
  // ********************************************************************
  // ** GIVEN the app is started the way a release starts
  // ********************************************************************
  const app = await startsAppLikeARelease();

  // ********************************************************************
  // ** WHEN the browser opens the app
  // ********************************************************************
  // ********************************************************************
  // ** THEN the page loads bundled scripts, not Vite's client or source files
  // ********************************************************************
  await expectTheAppToServeABuiltUi(app);
  // AND the UI of the data folder is what was built
  await expectTheServedUiToShow(app, "Status");
});

test("a release that ships its default UI already built serves it at once on a first start", async () => {
  // ********************************************************************
  // ** GIVEN a release that ships its default UI built
  // ********************************************************************
  // ********************************************************************
  // ** WHEN the app starts for the first time
  // ********************************************************************
  const app = await startsAppLikeAReleaseThatShipsTheUiBuilt();

  // ********************************************************************
  // ** THEN the very first answer is that shipped build, with nothing to wait for
  // ********************************************************************
  await expectTheShippedBuildToBeServedAtOnce(app, SHIPPED_BUILD_MARKER);
});

test("a change that passed the checks is served as a fresh build while it waits for Keep", async () => {
  // ********************************************************************
  // ** GIVEN the app serves its built UI
  // ********************************************************************
  const app = await startsAppLikeARelease();
  await expectTheServedUiToShow(app, "Status");
  // AND the Modify agent will add a cost column
  app.mockAgent.willWriteFile("src/session-table.ts", withCost);

  // ********************************************************************
  // ** WHEN the user asks for a cost column and it passes the checks
  // ********************************************************************
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** THEN the served UI already shows the cost column, so the user can review it
  // ********************************************************************
  await expectTheServedUiToShow(app, "Cost");
});

test("Undo of a change that waits for Keep serves the UI from before", async () => {
  // ********************************************************************
  // ** GIVEN a cost column change that waits for Keep, shown by the served UI
  // ********************************************************************
  const app = await startsAppLikeARelease();
  app.mockAgent.willWriteFile("src/session-table.ts", withCost);
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);
  await expectTheServedUiToShow(app, "Cost");

  // ********************************************************************
  // ** WHEN the user presses Undo
  // ********************************************************************
  await app.user.undoesTheChange();

  // ********************************************************************
  // ** THEN the served UI is the one from before, without the cost column
  // ********************************************************************
  await expectTheServedUiToShow(app, "Status");
  await expectTheServedUiNotToShow(app, "Cost");
});

test("after Keep the served UI is the kept change, built", async () => {
  // ********************************************************************
  // ** GIVEN a cost column change that waits for Keep
  // ********************************************************************
  const app = await startsAppLikeARelease();
  app.mockAgent.willWriteFile("src/session-table.ts", withCost);
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** WHEN the user presses Keep
  // ********************************************************************
  await app.user.keepsTheChange();

  // ********************************************************************
  // ** THEN nothing waits any more and the served UI shows the cost column
  // ********************************************************************
  await expectNoChangeInProgress(app);
  await expectTheServedUiToShow(app, "Cost");
  // AND no notice about a failed build is on the page
  await expectThePageToCarryNoBuildNotice(app);
});

test("restoring an earlier version serves the build of that version", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a cost column change
  // ********************************************************************
  const app = await startsAppLikeARelease();
  await userKeptTableColumns(app, ["Title", "Status", "Cost"]);
  await expectTheServedUiToShow(app, "Cost");

  // ********************************************************************
  // ** WHEN the user restores the first version
  // ********************************************************************
  await userRestoresTheFirstUiVersion(app);

  // ********************************************************************
  // ** THEN the served UI is the first version's, without the cost column
  // ********************************************************************
  await expectTheServedUiToShow(app, "Status");
  await expectTheServedUiNotToShow(app, "Cost");
});

test("a default UI update is served once it is merged", async () => {
  // ********************************************************************
  // ** GIVEN the user kept a cost column change, and default UI 1.1 was released
  // ********************************************************************
  const app = await aCostColumnWasKeptAndDefaultUiOnePointOneIsReleased();

  // ********************************************************************
  // ** WHEN the user applies the update
  // ********************************************************************
  await app.user.appliesTheDefaultUiUpdate();
  await expectUiChangeReadyToKeep(app);

  // ********************************************************************
  // ** THEN the served UI has the new footer and still the cost column
  // ********************************************************************
  await expectTheServedUiToShow(app, "AgentControl 1.1");
  await expectTheServedUiToShow(app, "Cost");
});
