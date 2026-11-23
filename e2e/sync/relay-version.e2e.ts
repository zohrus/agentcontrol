import { afterEach, test } from "bun:test";
import {
  expectRelayToBeOfThisRelease,
  expectWorkspaceToNeedARelayUpdate,
} from "../support/expect/relay-version-expectations.ts";
import { expectAgentOffered } from "../support/expect/app-workspace-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("the relay reports the version of the release, taken from the root package.json", async () => {
  // ********************************************************************
  // ** GIVEN an app connected to a relay of the same release
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user looks at the workspace (nothing more to do: the app connected at start)
  // ********************************************************************

  // ********************************************************************
  // ** THEN it is connected, and the relay's version is the root package.json's
  // ********************************************************************
  await expectRelayToBeOfThisRelease(app);
});

test("a relay of another version is recorded as needing an update, and keeps working", async () => {
  // ********************************************************************
  // ** GIVEN a relay that says it is version 0.0.1, older than this release
  // ********************************************************************
  const relayVersion = "0.0.1";

  // ********************************************************************
  // ** WHEN the app connects to it
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ relayVersion });

  // ********************************************************************
  // ** THEN the workspace says the relay needs an update, with the version it has
  // ********************************************************************
  await expectWorkspaceToNeedARelayUpdate(app, relayVersion);
  // AND the relay is still used as it is
  expectAgentOffered(await app.user.listsTheAgents(), "mock");
});
