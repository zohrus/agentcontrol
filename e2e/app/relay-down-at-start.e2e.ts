import { afterEach, test } from "bun:test";
import {
  expectAppToFindTheRelay,
  expectAppToServeAndReportTheRelayDisconnected,
  expectLiveStreamToReportTheRelayConnected,
} from "../support/expect/app-start-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWhoseRelayCommandFailsAtFirst } from "../support/setup/flaky-relay-app.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("an app started while the relay is down serves requests, says disconnected, and connects when the relay is up", async () => {
  // ********************************************************************
  // ** GIVEN the relay is not running and the app is started anyway
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ relayStopped: true });

  // ********************************************************************
  // ** WHEN the user asks the app for its workspace and its health
  // ********************************************************************
  // (the app answers at all: starting did not wait for the relay)

  // ********************************************************************
  // ** THEN both say the relay is disconnected
  // ********************************************************************
  await expectAppToServeAndReportTheRelayDisconnected(app);

  // ********************************************************************
  // ** WHEN the relay starts
  // ********************************************************************
  await app.theRelayStartsAgain();

  // ********************************************************************
  // ** THEN the app connects on its own, and the live stream says so
  // ********************************************************************
  await expectAppToFindTheRelay(app);
  await expectLiveStreamToReportTheRelayConnected(app);
});

test("an app whose relay command fails at first keeps retrying and connects once the command works", async () => {
  // ********************************************************************
  // ** GIVEN the app started as a process with a relay command that fails
  // ********************************************************************
  const app = await startAppWhoseRelayCommandFailsAtFirst();
  await expectAppToServeAndReportTheRelayDisconnected(app);

  // ********************************************************************
  // ** WHEN the relay command starts working
  // ********************************************************************
  await app.theRelayCommandWorks();

  // ********************************************************************
  // ** THEN the app connects to the relay without being restarted
  // ********************************************************************
  await expectAppToFindTheRelay(app);
});
