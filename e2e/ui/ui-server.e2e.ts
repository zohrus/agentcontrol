import { afterEach, test } from "bun:test";
import { expectUiToBeServedAgain } from "../support/expect/ui-server-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";
import { theUiServerProcessIsKilled } from "../support/setup/ui-server.ts";

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
