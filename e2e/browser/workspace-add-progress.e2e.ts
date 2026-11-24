import { afterEach, test } from "bun:test";
import { expectDialogToShow } from "../support/browser/page-expectations.ts";
import { startSshAppInBrowser } from "../support/browser/start-ssh-app-in-browser.ts";
import {
  expectDialogNotToShow,
  expectSetupStepsToHaveBeenShownInOrder,
} from "../support/browser/workspaces-browser-expectations.ts";
import {
  addsTheHostInTheForm,
  opensTheAddFormWatchingTheSteps,
} from "../support/browser/workspaces-setups.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

// Every ssh call is a real handshake and the suite runs files side by side.
const SSH_BROWSER_TEST_TIMEOUT_MS = 90_000;

afterEach(cleanUpAfterTest);

test(
  "adding a host shows each setup step while it runs, in order, and ends connected",
  async () => {
    // ********************************************************************
    // ** GIVEN the Add workspace form is open, and the page notes what the dialog shows
    // ********************************************************************
    const app = await startSshAppInBrowser();
    await opensTheAddFormWatchingTheSteps(app);

    // ********************************************************************
    // ** WHEN the user adds the host
    // ********************************************************************
    await addsTheHostInTheForm(app);

    // ********************************************************************
    // ** THEN the steps were shown as running, then passed, one after the other
    // ********************************************************************
    await expectSetupStepsToHaveBeenShownInOrder(app, [
      "Connect to the host: Checking",
      "Connect to the host: Passed",
      "Relay running: Checking",
      "Relay running: Passed",
      "Find agents: Checking",
      "Find agents: Passed",
      "Repositories: Passed",
    ]);
    // AND the workspace is connected
    await expectDialogToShow(app, "The workspace is connected.");
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a host that cannot be reached stops at the connect step and says why",
  async () => {
    // ********************************************************************
    // ** GIVEN a host that refuses connections, and the Add workspace form open
    // ********************************************************************
    const app = await startSshAppInBrowser();
    app.host.network.goesDown();
    await opensTheAddFormWatchingTheSteps(app);

    // ********************************************************************
    // ** WHEN the user adds the host
    // ********************************************************************
    await addsTheHostInTheForm(app);

    // ********************************************************************
    // ** THEN the connect step is shown as running and then failed, with the reason
    // ********************************************************************
    await expectSetupStepsToHaveBeenShownInOrder(app, [
      "Connect to the host: Checking",
      "Connect to the host: Failed",
    ]);
    await expectDialogToShow(app, "refused the connection");
    // AND no later step was tried
    await expectDialogNotToShow(app, "Operating system and CPU");
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);
