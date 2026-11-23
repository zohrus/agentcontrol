import { afterEach, test } from "bun:test";
import { expectThisMacToBe } from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { machineWithRelayOfAnotherVersion } from "../support/setup/machines.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("an app that finds a relay of another version on this Mac still starts, and says the relay needs an update", async () => {
  // ********************************************************************
  // ** GIVEN a relay of an older version is already running on this Mac
  // ********************************************************************
  const relayEnv = machineWithRelayOfAnotherVersion;

  // ********************************************************************
  // ** WHEN the app starts
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ relayEnv });

  // ********************************************************************
  // ** THEN This Mac is listed as needing a relay update
  // ********************************************************************
  await expectThisMacToBe(app, "needs-relay-update");
});
