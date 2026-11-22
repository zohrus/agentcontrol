import { afterEach, test } from "bun:test";
import {
  expectModifyPanelNotToShow,
  expectModifyPanelToShow,
} from "../support/browser/modify-browser-expectations.ts";
import { startModifiableAppInBrowser } from "../support/browser/modify-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { userKeptTableColumns } from "../support/setup/modify-history.ts";
import { releaseDefaultUiUpdate } from "../support/setup/modify-app.ts";

afterEach(cleanUpAfterTest);

const newFooter = { "src/footer.ts": 'export const footer = "AgentControl 1.1";\n' };

test(
  "a new default UI is offered in the panel and, once merged, summarised for Keep or Undo",
  async () => {
    // ********************************************************************
    // ** GIVEN the user kept a cost column change and default UI 1.1 is released
    // ********************************************************************
    const app = await startModifiableAppInBrowser();
    await userKeptTableColumns(app, ["Title", "Status", "Cost"]);
    await releaseDefaultUiUpdate(app, { version: "1.1", files: newFooter });
    await app.page.opensTheModifyPanel();
    await expectModifyPanelToShow(app, "Update 1.1 available");

    // ********************************************************************
    // ** WHEN the user presses Update
    // ********************************************************************
    await app.page.appliesTheDefaultUiUpdate();

    // ********************************************************************
    // ** THEN the panel says what the merge did and waits for Keep or Undo
    // ********************************************************************
    await expectModifyPanelToShow(app, "Updated to 1.1.");
    await expectModifyPanelToShow(app, "1 of your changes kept automatically");
    // AND pressing Keep ends it
    await app.page.keepsTheChange();
    await expectModifyPanelNotToShow(app, "Updated to 1.1.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
