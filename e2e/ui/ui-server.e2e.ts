import { afterEach, test } from "bun:test";
import {
  expectTheLeftoverUiServerToBeStopped,
  expectUiToBeServedAgain,
} from "../support/expect/ui-server-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";
import { aUiServerIsLeftRunning, theUiServerProcessIsKilled } from "../support/setup/ui-server.ts";

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
