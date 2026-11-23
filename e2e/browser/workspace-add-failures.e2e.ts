import { afterEach, test } from "bun:test";
import { expectDialogToShow } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { startSshAppInBrowser } from "../support/browser/start-ssh-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

// Every ssh call is a real handshake and the suite runs files side by side.
const SSH_BROWSER_TEST_TIMEOUT_MS = 90_000;

afterEach(cleanUpAfterTest);

test(
  "a host that cannot be reached shows the step that failed, and Retry connects once it is back",
  async () => {
    // ********************************************************************
    // ** GIVEN a host that refuses connections, and the user adds it as a workspace
    // ********************************************************************
    const app = await startSshAppInBrowser();
    app.host.network.goesDown();
    await app.page.opensTheWorkspaceMenu();
    await app.page.choosesAddWorkspace();
    await app.page.typesTheHost(app.host.alias);
    await app.page.submitsTheHost();
    await expectDialogToShow(app, "Connect to the host failed", "refused the connection");

    // ********************************************************************
    // ** WHEN the host is back and the user presses Retry
    // ********************************************************************
    app.host.network.comesBack();
    await app.page.retriesTheSetup();

    // ********************************************************************
    // ** THEN the checklist passes and the workspace is connected
    // ********************************************************************
    await expectDialogToShow(app, "The workspace is connected.");
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a host name that cannot be used is refused in the form, in plain words",
  async () => {
    // ********************************************************************
    // ** GIVEN the Add workspace form is open
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.opensTheWorkspaceMenu();
    await app.page.choosesAddWorkspace();

    // ********************************************************************
    // ** WHEN the user types a host name with spaces in it and adds it
    // ********************************************************************
    await app.page.typesTheHost("not a host");
    await app.page.submitsTheHost();

    // ********************************************************************
    // ** THEN the form says the host could not be used
    // ********************************************************************
    await expectDialogToShow(app, "could not use what was entered");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
