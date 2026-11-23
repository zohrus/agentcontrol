import { afterEach, test } from "bun:test";
import {
  expectModifyPanelNotToShow,
  expectModifyPanelToShow,
} from "../support/browser/modify-browser-expectations.ts";
import {
  defaultUiUpdateOfferedInModifyPanel,
  defaultUiUpdateMergedInModifyPanel,
} from "../support/browser/modify-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "pressing Update merges the new default UI and the panel summarises it for Keep or Undo",
  async () => {
    // ********************************************************************
    // ** GIVEN the user kept a cost column change and the panel offers default UI 1.1
    // ********************************************************************
    const app = await defaultUiUpdateOfferedInModifyPanel();

    // ********************************************************************
    // ** WHEN the user presses Update
    // ********************************************************************
    await app.page.appliesTheDefaultUiUpdate();

    // ********************************************************************
    // ** THEN the panel says what the merge did
    // ********************************************************************
    await expectModifyPanelToShow(app, "Updated to 1.1.");
    await expectModifyPanelToShow(app, "1 of your changes kept automatically");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Keep on the update banner finishes the update",
  async () => {
    // ********************************************************************
    // ** GIVEN default UI 1.1 is merged and the panel waits for Keep or Undo
    // ********************************************************************
    const app = await defaultUiUpdateMergedInModifyPanel();

    // ********************************************************************
    // ** WHEN the user presses Keep
    // ********************************************************************
    await app.page.keepsTheChange();

    // ********************************************************************
    // ** THEN the update banner is gone
    // ********************************************************************
    await expectModifyPanelNotToShow(app, "Updated to 1.1.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
