import { afterEach, test } from "bun:test";
import {
  expectThePageToRunAProductionBuild,
  expectThePageToShowByItself,
} from "../support/browser/production-ui-expectations.ts";
import {
  startReleaseWithATinyUiInABrowser,
  startReleaseWithTheDefaultUiInABrowser,
} from "../support/browser/production-ui-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { expectUiChangeReadyToKeep } from "../support/expect/modify-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { sessionTableWith } from "../support/setup/fixture-ui.ts";

afterEach(cleanUpAfterTest);

test(
  "the default UI of a released app runs as a production build",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is started the way a release starts, with the default UI
    // ********************************************************************
    // ********************************************************************
    // ** WHEN the user opens it in a browser
    // ********************************************************************
    const app = await startReleaseWithTheDefaultUiInABrowser();

    // ********************************************************************
    // ** THEN the page works, and runs React's production build from built files
    // ********************************************************************
    await expectThePageToRunAProductionBuild(app.page);
  },
  BROWSER_TEST_TIMEOUT_MS * 2,
);

test(
  "an open page shows a change the Modify agent made without being reloaded by hand",
  async () => {
    // ********************************************************************
    // ** GIVEN a released app whose page is open in a browser
    // ********************************************************************
    const app = await startReleaseWithATinyUiInABrowser();
    await expectThePageToShowByItself(app.page, "Title | Status");
    // AND the Modify agent will add a cost column
    app.mockAgent.willWriteFile(
      "src/session-table.ts",
      sessionTableWith("Title", "Status", "Cost"),
    );

    // ********************************************************************
    // ** WHEN the user asks for a cost column and it passes the checks
    // ********************************************************************
    await app.user.asksToModifyTheUi("add a cost column");
    await expectUiChangeReadyToKeep(app);

    // ********************************************************************
    // ** THEN the open page shows the cost column by itself
    // ********************************************************************
    await expectThePageToShowByItself(app.page, "Title | Status | Cost");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
