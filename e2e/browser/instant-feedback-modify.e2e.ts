import { afterEach, test } from "bun:test";
import {
  costColumnChangeReadyInModifyPanel,
  modifyPanelOpenWithAgentAddingCostColumn,
} from "../support/browser/modify-setups.ts";
import { pageShows } from "../support/browser/reaction.ts";
import { expectPageToReactAtOnce } from "../support/browser/reaction-expectations.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "asking the Modify agent for a change shows the request in the chat at once",
  async () => {
    // ********************************************************************
    // ** GIVEN the Modify panel is open and the Modify agent will add a Cost column
    // ********************************************************************
    const app = await modifyPanelOpenWithAgentAddingCostColumn();

    // ********************************************************************
    // ** WHEN the user sends "add a cost column"
    // ********************************************************************
    // ********************************************************************
    // ** THEN the request is in the chat straight away
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Send Modify request",
      act: () => app.page.asksToModifyTheUi("add a cost column"),
      shown: pageShows("add a cost column"),
      reads: "show the request in the chat",
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "pressing Keep on a change says it is keeping it at once",
  async () => {
    // ********************************************************************
    // ** GIVEN a change the Modify agent made, waiting in the panel for Keep or Undo
    // ********************************************************************
    const app = await costColumnChangeReadyInModifyPanel();

    // ********************************************************************
    // ** WHEN the user presses Keep
    // ********************************************************************
    // ********************************************************************
    // ** THEN the button says it is keeping the change straight away
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Keep change",
      act: () => app.page.keepsTheChange(),
      shown: pageShows("Keeping…"),
      reads: "say that the change is being kept",
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
