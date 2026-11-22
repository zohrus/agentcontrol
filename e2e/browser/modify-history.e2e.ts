import { afterEach, test } from "bun:test";
import {
  expectBrowserOnPath,
  expectModifyPanelToShow,
} from "../support/browser/modify-browser-expectations.ts";
import {
  modifyAgentWillShowColumns,
  startModifiableAppInBrowser,
} from "../support/browser/modify-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { userKeptTableColumns } from "../support/setup/modify-history.ts";

afterEach(cleanUpAfterTest);

test(
  "Undo with nothing waiting brings the previous version back as a new version",
  async () => {
    // ********************************************************************
    // ** GIVEN the user kept a cost column change and has the Modify panel open
    // ********************************************************************
    const app = await startModifiableAppInBrowser();
    await userKeptTableColumns(app, ["Title", "Cost"]);
    await app.page.opensTheModifyPanel();
    await expectModifyPanelToShow(app, "History (2)");

    // ********************************************************************
    // ** WHEN the user presses Undo
    // ********************************************************************
    await app.page.undoesTheLastKeptChange();

    // ********************************************************************
    // ** THEN the history records the undo as a new version
    // ********************************************************************
    await expectModifyPanelToShow(app, "History (3)");
    // AND no change waits for Keep
    await expectModifyPanelToShow(app, "Describe a change to get started.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Restore brings back an older version once the user confirms",
  async () => {
    // ********************************************************************
    // ** GIVEN the user kept a Cost column and then a Branch column, with the history open
    // ********************************************************************
    const app = await startModifiableAppInBrowser();
    await userKeptTableColumns(app, ["Title", "Cost"]);
    await userKeptTableColumns(app, ["Title", "Branch"]);
    await app.page.opensTheModifyPanel();
    await app.page.opensTheVersionHistory();
    await expectModifyPanelToShow(app, "History (3)");

    // ********************************************************************
    // ** WHEN the user restores the Cost column version and confirms
    // ********************************************************************
    await app.page.startsRestoringTheVersion("show Title, Cost");
    await expectModifyPanelToShow(app, "Restore this version?");
    await app.page.confirmsTheRestore();

    // ********************************************************************
    // ** THEN the version is listed again as the newest one
    // ********************************************************************
    await expectModifyPanelToShow(app, "History (4)");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the panel still shows a change that waits for Keep after the page is reloaded",
  async () => {
    // ********************************************************************
    // ** GIVEN a cost column change that is ready in the Modify panel
    // ********************************************************************
    const app = await startModifiableAppInBrowser();
    await modifyAgentWillShowColumns(app, ["Title", "Cost"]);
    await app.page.opensTheModifyPanel();
    await app.page.asksToModifyTheUi("add a cost column");
    await expectModifyPanelToShow(app, "Ready");

    // ********************************************************************
    // ** WHEN the page is reloaded
    // ********************************************************************
    await app.page.reloadsThePage();

    // ********************************************************************
    // ** THEN the panel is open again, still Ready, with the changed file
    // ********************************************************************
    await expectModifyPanelToShow(app, "Ready");
    await expectModifyPanelToShow(app, "src/session-table.ts");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the recovery link of the panel opens the recovery page",
  async () => {
    // ********************************************************************
    // ** GIVEN the Modify panel is open, opened with its keyboard shortcut
    // ********************************************************************
    const app = await startModifiableAppInBrowser();
    await app.page.pressesTheModifyShortcut();
    await expectModifyPanelToShow(app, "If the UI breaks, open the recovery page");

    // ********************************************************************
    // ** WHEN the user follows the recovery link
    // ********************************************************************
    await app.page.followsTheRecoveryLink();

    // ********************************************************************
    // ** THEN the browser is on the recovery page
    // ********************************************************************
    await expectBrowserOnPath(app, "/_safe");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
