import { afterEach, test } from "bun:test";
import {
  expectBrowserVsCodeButtonToBeDisabledBecause,
  expectBrowserVsCodeButtonToBeEnabled,
  expectBrowserVsCodeButtonToSay,
  expectNewTabToShowTheWorkbench,
  expectScriptsOnTheIdeOriginToBeBlocked,
} from "../support/browser/ide-browser-expectations.ts";
import {
  opensAFinishedSessionWithACodeServerThatFails,
  opensAFinishedSessionWithCodeServer,
  opensAFinishedSessionWithoutCodeServer,
} from "../support/browser/ide-setups.ts";
import { openTab } from "../support/browser/open-tab.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "Open in browser VS Code opens code-server for the session in a new tab",
  async () => {
    // ********************************************************************
    // ** GIVEN a finished session open in the browser, on a workspace with code-server
    // ********************************************************************
    const { app } = await opensAFinishedSessionWithCodeServer();
    await expectBrowserVsCodeButtonToBeEnabled(app);

    // ********************************************************************
    // ** WHEN the user clicks "Open in browser VS Code"
    // ********************************************************************
    const tab = await app.page.opensBrowserVsCodeInANewTab();

    // ********************************************************************
    // ** THEN a new tab shows the workbench, served from another port than the app's
    // ********************************************************************
    await expectNewTabToShowTheWorkbench({ app, tab });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "without code-server on the workspace the button is disabled and says why",
  async () => {
    // ********************************************************************
    // ** GIVEN a finished session open in the browser, on a workspace without code-server
    // ********************************************************************
    const { app } = await opensAFinishedSessionWithoutCodeServer();

    // ********************************************************************
    // ** WHEN the user looks at "Open in browser VS Code"
    // ********************************************************************
    // ********************************************************************
    // ** THEN it is disabled, and its note says code-server is not installed and how to install it
    // ********************************************************************
    await expectBrowserVsCodeButtonToBeDisabledBecause(app, "code-server is not installed on");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "when the workspace goes offline the button is disabled and says the session is read-only",
  async () => {
    // ********************************************************************
    // ** GIVEN a finished session open in the browser, on a workspace with code-server
    // ********************************************************************
    const { app } = await opensAFinishedSessionWithCodeServer();
    await expectBrowserVsCodeButtonToBeEnabled(app);

    // ********************************************************************
    // ** WHEN the workspace's relay stops
    // ********************************************************************
    await app.theRelayStops();

    // ********************************************************************
    // ** THEN the button is disabled, with the reason that the workspace's sessions are read-only
    // ********************************************************************
    await expectBrowserVsCodeButtonToBeDisabledBecause(app, "read-only");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a script in the browser VS Code cannot call the app or read its page",
  async () => {
    // ********************************************************************
    // ** GIVEN the browser VS Code of a session is open, and its page runs a script that
    // ** tries to call the app's API and to read the app's page
    // ********************************************************************
    const { app, session } = await opensAFinishedSessionWithCodeServer();
    const address = await app.sdk.ide.openIde(session.id);
    const tab = await openTab();

    // ********************************************************************
    // ** WHEN that script runs
    // ********************************************************************
    await tab.goto(`${address}attack?app=${encodeURIComponent(app.baseUrl)}`);

    // ********************************************************************
    // ** THEN the browser blocks every attempt
    // ********************************************************************
    await expectScriptsOnTheIdeOriginToBeBlocked(tab);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "when code-server cannot start, the button says what went wrong and no empty tab is left",
  async () => {
    // ********************************************************************
    // ** GIVEN a finished session open in the browser, on a workspace whose code-server exits at once
    // ********************************************************************
    const { app } = await opensAFinishedSessionWithACodeServerThatFails();
    await expectBrowserVsCodeButtonToBeEnabled(app);

    // ********************************************************************
    // ** WHEN the user clicks "Open in browser VS Code"
    // ********************************************************************
    await app.page.clicksOpenInBrowserVsCode();

    // ********************************************************************
    // ** THEN the button's note says what code-server printed
    // ********************************************************************
    await expectBrowserVsCodeButtonToSay(app, "cannot start");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
