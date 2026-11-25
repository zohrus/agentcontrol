import { afterEach, test } from "bun:test";
import {
  expectAPlainPageThatLinksTheRecoveryPage,
  expectThePageToCarryNoBuildNotice,
  expectThePageToSayTheLastChangeCouldNotBeBuilt,
  expectTheRecoveryPageToExplainTheFailedBuild,
  expectTheRecoveryPageToReportNoFailedBuild,
  expectTheServedUiNotToShow,
  expectTheServedUiToShow,
} from "../support/expect/production-ui-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  aCostChangeWaitsForKeepAndTheLiveUiWasBrokenByHand,
  startsAppLikeAReleaseWhoseUiCannotBeBuilt,
} from "../support/setup/production-ui.ts";

afterEach(cleanUpAfterTest);

test("a Keep whose build fails keeps serving the UI from before and says so", async () => {
  // ********************************************************************
  // ** GIVEN a cost column change that waits for Keep
  // ********************************************************************
  // AND the live UI was edited by hand meanwhile into something no build can read
  const app = await aCostChangeWaitsForKeepAndTheLiveUiWasBrokenByHand();

  // ********************************************************************
  // ** WHEN the user presses Keep
  // ********************************************************************
  await app.user.keepsTheChange();

  // ********************************************************************
  // ** THEN the page still shows the last build and tells the user plainly what happened
  // ********************************************************************
  await expectTheServedUiToShow(app, "Cost");
  await expectThePageToSayTheLastChangeCouldNotBeBuilt(app);
  // AND the recovery page explains the failure
  await expectTheRecoveryPageToExplainTheFailedBuild(app);
});

test("the recovery page brings back a UI that works after a build failed", async () => {
  // ********************************************************************
  // ** GIVEN a Keep whose build failed
  // ********************************************************************
  const app = await aCostChangeWaitsForKeepAndTheLiveUiWasBrokenByHand();
  await app.user.keepsTheChange();
  await expectThePageToSayTheLastChangeCouldNotBeBuilt(app);

  // ********************************************************************
  // ** WHEN the user presses "Undo last change" on the recovery page
  // ********************************************************************
  await app.user.undoesTheChange();

  // ********************************************************************
  // ** THEN the UI from before is served again and nothing says it failed
  // ********************************************************************
  await expectTheServedUiToShow(app, "Status");
  await expectTheServedUiNotToShow(app, "Cost");
  await expectThePageToCarryNoBuildNotice(app);
  await expectTheRecoveryPageToReportNoFailedBuild(app);
});

test("an app with no build to show says plainly that the UI could not be built", async () => {
  // ********************************************************************
  // ** GIVEN a release whose default UI cannot be built
  // ********************************************************************
  // ********************************************************************
  // ** WHEN the app starts and tries to build it
  // ********************************************************************
  const app = await startsAppLikeAReleaseWhoseUiCannotBeBuilt();

  // ********************************************************************
  // ** THEN the page is a plain message with a link to the recovery page, not a blank page
  // ********************************************************************
  await expectAPlainPageThatLinksTheRecoveryPage(app);
});
