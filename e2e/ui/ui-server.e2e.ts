import { afterEach, test } from "bun:test";
import {
  expectTheLeftoverUiServerToBeStopped,
  expectUiToBeServedAgain,
} from "../support/expect/ui-server-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";
import { expectProcessToBeGone } from "../support/expect/terminal-expectations.ts";
import {
  aUiServerIsLeftRunning,
  theUiServerIgnoresTheQuitSignal,
  theUiServerProcessIsKilled,
  theUiServerProcessOf,
} from "../support/setup/ui-server.ts";

afterEach(cleanUpAfterTest);

test("the UI is served again when the process that runs it dies", async () => {
  // ********************************************************************
  // ** GIVEN the app is serving the default UI
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ withUi: true });

  // ********************************************************************
  // ** WHEN the process that runs the UI is killed
  // ********************************************************************
  theUiServerProcessIsKilled();

  // ********************************************************************
  // ** THEN the app starts it again and serves the UI page as before
  // ********************************************************************
  await expectUiToBeServedAgain(app);
});

test("the UI server an earlier run left behind is stopped when the app starts", async () => {
  // ********************************************************************
  // ** GIVEN the app is serving the default UI
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ withUi: true });
  // AND an earlier run of the app left its UI server running
  const leftover = await aUiServerIsLeftRunning(app);

  // ********************************************************************
  // ** WHEN the app starts again
  // ********************************************************************
  await app.restartsTheApp();

  // ********************************************************************
  // ** THEN the server the earlier run left behind has been stopped
  // ********************************************************************
  await expectTheLeftoverUiServerToBeStopped(leftover);
});

test("a UI server that ignores the quit signal is killed when the app quits", async () => {
  // ********************************************************************
  // ** GIVEN the app is serving a UI whose server ignores the signal that asks it to quit
  // ********************************************************************
  await theUiServerIgnoresTheQuitSignal();
  const app = await startAppWithLocalWorkspace({ withUi: true });
  const pid = await theUiServerProcessOf(app);

  // ********************************************************************
  // ** WHEN the app quits
  // ********************************************************************
  await app.restartsTheApp();

  // ********************************************************************
  // ** THEN the UI server process is gone, killed after the grace period
  // ********************************************************************
  await expectProcessToBeGone(pid, "the UI server");
});
