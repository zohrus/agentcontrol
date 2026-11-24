import { afterEach, setDefaultTimeout, test } from "bun:test";
import {
  expectWorkspaceToBe,
  expectWorkspaceToExplain,
  expectWorkspaceToNotSuggest,
} from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("an app run from source that has not built the relay for the host says how to build it", async () => {
  // ********************************************************************
  // ** GIVEN an app run from a source checkout whose dist folder has no relay for the host
  // ********************************************************************
  const { user } = await startAppWithSshHost({ relayBinaryNotBuilt: true });

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is offline and says which relay is missing
  // ********************************************************************
  expectWorkspaceToBe(workspace, "offline");
  expectWorkspaceToExplain(workspace, "This app has no relay for linux");
  // AND it says to build it once with the build script and retry
  expectWorkspaceToExplain(
    workspace,
    "Build it once with: bun scripts/build.ts --only relay-linux, then retry.",
  );
});

test("an installed app that lacks the relay for the host does not tell the user to build it", async () => {
  // ********************************************************************
  // ** GIVEN an installed app whose release folder has no relay for the host
  // ********************************************************************
  const { user } = await startAppWithSshHost({ relayBinaryMissing: true });

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace says there is no relay for the host
  // ********************************************************************
  expectWorkspaceToExplain(workspace, "This app has no relay for linux");
  // AND it gives no build instructions
  expectWorkspaceToNotSuggest(workspace, "scripts/build.ts");
});
