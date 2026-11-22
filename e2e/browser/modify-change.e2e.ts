import { afterEach, test } from "bun:test";
import {
  expectModifyPanelToListChangedFile,
  expectModifyPanelToShow,
} from "../support/browser/modify-browser-expectations.ts";
import {
  costColumnChangeReadyInModifyPanel,
  modifyAgentWillAskToRunACommand,
  modifyAgentWillBreakTheTypes,
  modifyPanelOpenWithAgentAddingCostColumn,
  startModifiableAppInBrowser,
} from "../support/browser/modify-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "asking for a change shows the agent working and then Ready with the changed file",
  async () => {
    // ********************************************************************
    // ** GIVEN the Modify panel is open and the Modify agent will add a Cost column
    // ********************************************************************
    const app = await modifyPanelOpenWithAgentAddingCostColumn();

    // ********************************************************************
    // ** WHEN the user asks to add a cost column
    // ********************************************************************
    await app.page.asksToModifyTheUi("add a cost column");

    // ********************************************************************
    // ** THEN the chat shows what the agent said and the panel says Ready
    // ********************************************************************
    await expectModifyPanelToShow(app, "I am adding the columns to the session table.");
    await expectModifyPanelToShow(app, "Ready");
    // AND the changed file is listed
    await expectModifyPanelToListChangedFile(app, "src/session-table.ts");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Keep adds a version named after the request",
  async () => {
    // ********************************************************************
    // ** GIVEN a cost column change that is ready in the Modify panel
    // ********************************************************************
    const app = await costColumnChangeReadyInModifyPanel();

    // ********************************************************************
    // ** WHEN the user presses Keep
    // ********************************************************************
    await app.page.keepsTheChange();

    // ********************************************************************
    // ** THEN the version history lists the change under the user's words
    // ********************************************************************
    await app.page.opensTheVersionHistory();
    await expectModifyPanelToShow(app, "add a cost column");
    await expectModifyPanelToShow(app, "History (2)");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Undo drops the change that waits and the panel is ready for a new request",
  async () => {
    // ********************************************************************
    // ** GIVEN a cost column change that is ready in the Modify panel
    // ********************************************************************
    const app = await costColumnChangeReadyInModifyPanel();

    // ********************************************************************
    // ** WHEN the user presses Undo
    // ********************************************************************
    await app.page.undoesTheChange();

    // ********************************************************************
    // ** THEN nothing waits any more and no version was added
    // ********************************************************************
    await expectModifyPanelToShow(app, "Describe a change to get started.");
    await app.page.opensTheVersionHistory();
    await expectModifyPanelToShow(app, "History (1)");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a change that fails the checks shows why and Discard clears it",
  async () => {
    // ********************************************************************
    // ** GIVEN the Modify agent keeps writing code that does not pass the checks
    // ********************************************************************
    const app = await startModifiableAppInBrowser();
    await modifyAgentWillBreakTheTypes(app);
    await app.page.opensTheModifyPanel();

    // ********************************************************************
    // ** WHEN the user asks to add a cost column and the agent gives up
    // ********************************************************************
    await app.page.asksToModifyTheUi("add a cost column");
    await expectModifyPanelToShow(app, "nothing was changed");
    // AND the panel shows what the check said
    await expectModifyPanelToShow(app, "TS2322");

    // ********************************************************************
    // ** THEN Discard clears the failure
    // ********************************************************************
    await app.page.discardsTheChange();
    await expectModifyPanelToShow(app, "Describe a change to get started.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a request the Modify agent was not allowed to make is shown in the chat with its reason",
  async () => {
    // ********************************************************************
    // ** GIVEN the Modify panel is open and the Modify agent will ask to run `npm install`
    // ********************************************************************
    const app = await startModifiableAppInBrowser();
    await modifyAgentWillAskToRunACommand(app, "npm install");
    await app.page.opensTheModifyPanel();

    // ********************************************************************
    // ** WHEN the user asks to add a cost column
    // ********************************************************************
    await app.page.asksToModifyTheUi("add a cost column");

    // ********************************************************************
    // ** THEN the chat says the command was refused, and why
    // ********************************************************************
    await expectModifyPanelToShow(app, "Only file edits are allowed in this session.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
