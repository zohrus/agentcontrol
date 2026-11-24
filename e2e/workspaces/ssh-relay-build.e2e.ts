import { afterEach, setDefaultTimeout, test } from "bun:test";
import { VERSION } from "@agentcontrol/protocol";
import {
  expectWorkspaceListedAs,
  expectWorkspaceToBe,
  expectWorkspaceToExplain,
} from "../support/expect/ssh-expectations.ts";
import {
  expectHostRelayToBeUntouched,
  expectHostRelayToHaveBeenReplaced,
  expectInstalledRelayToBeTheAppsOwn,
} from "../support/expect/ssh-host-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { leaveDistBuiltFromOlderCode } from "../support/setup/ssh-built-relay-folder.ts";
import {
  leaveAnOlderBuildInstalledOn,
  relayRunningOn,
  startOldRelayOnHost,
} from "../support/setup/ssh-old-relay.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

const OTHER_CODE = { version: VERSION, buildId: "built-before-the-update" };

test("a relay running other code under the same version, with nothing working, is replaced and the app connects", async () => {
  // ********************************************************************
  // ** GIVEN the host runs a relay of this version built from other code, with no session working
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  const old = await startOldRelayOnHost(host, OTHER_CODE);

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is connected
  // ********************************************************************
  expectWorkspaceToBe(workspace, "connected");
  // AND the host's relay is a new one, started from the app's own build
  await expectHostRelayToHaveBeenReplaced(host, old);
});

test("a relay running other code under the same version with a session working is left alone, and the workspace says why", async () => {
  // ********************************************************************
  // ** GIVEN the host runs a relay of this version built from other code, whose agent is working
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  const old = await startOldRelayOnHost(host, OTHER_CODE);
  await old.startsWorkingSession();

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace needs a relay update and says the relay runs other code
  // ********************************************************************
  expectWorkspaceToBe(workspace, "needs-relay-update");
  expectWorkspaceToExplain(workspace, "The relay runs other code than this app");
  // AND that a session is still working, and what to do about it
  expectWorkspaceToExplain(workspace, "still working on it, so it was left running");
  expectWorkspaceToExplain(workspace, "use Restart relay");
  // AND the old relay keeps running with its session
  await expectHostRelayToBeUntouched(host, old);
});

test("a relay file an earlier build of the same version left on the host is replaced when the app reconnects", async () => {
  // ********************************************************************
  // ** GIVEN a connected host workspace whose installed relay is then replaced by an older build's
  // ********************************************************************
  const { host, user, app } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  expectWorkspaceToBe(workspace, "connected");
  await leaveAnOlderBuildInstalledOn(host);

  // ********************************************************************
  // ** WHEN the relay stops and the app connects to the host again
  // ********************************************************************
  await user.restartsTheRelayOn(workspace);

  // ********************************************************************
  // ** THEN the relay file on the host is the app's own
  // ********************************************************************
  await expectInstalledRelayToBeTheAppsOwn(host);
  // AND the workspace is connected
  await expectWorkspaceListedAs(app, { workspace, state: "connected" });
});

test("an app run from source whose built relay is older than the source says how to build it again", async () => {
  // ********************************************************************
  // ** GIVEN an app run from a source checkout whose dist folder holds a relay built from older code
  // ********************************************************************
  const { user } = await startAppWithSshHost({ relayBuiltFromSource: "older-code" });

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is offline and says the relay was built from other code
  // ********************************************************************
  expectWorkspaceToBe(workspace, "offline");
  expectWorkspaceToExplain(workspace, "was built from build 0123456789ab, but this checkout");
  // AND it says to build it again with the build script and retry
  expectWorkspaceToExplain(
    workspace,
    "Build it again with: bun scripts/build.ts --only relay-linux, then retry.",
  );
});

test("an app run from source whose built relay is from the current source installs it", async () => {
  // ********************************************************************
  // ** GIVEN an app run from a source checkout whose dist folder holds a relay built from its code
  // ********************************************************************
  const { user } = await startAppWithSshHost({ relayBuiltFromSource: "this-checkout" });

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is connected
  // ********************************************************************
  expectWorkspaceToBe(workspace, "connected");
});

test("a host that was connected keeps working when the source is edited and the app reconnects", async () => {
  // ********************************************************************
  // ** GIVEN an app run from a source checkout, connected to a host with the relay built from it
  // ********************************************************************
  const { host, user, app } = await startAppWithSshHost({
    relayBuiltFromSource: "this-checkout",
  });
  const workspace = await user.addsTheHost();
  expectWorkspaceToBe(workspace, "connected");
  const before = await relayRunningOn(host);
  // AND the relay code is edited afterwards, so the relay in dist/ is older than the source
  await leaveDistBuiltFromOlderCode(host);

  // ********************************************************************
  // ** WHEN the connection drops and the app connects to the host again
  // ********************************************************************
  await user.restartsTheRelayOn(workspace);

  // ********************************************************************
  // ** THEN the host runs a new relay and the workspace is connected
  // ********************************************************************
  await expectHostRelayToHaveBeenReplaced(host, before);
  // AND the workspace is connected
  await expectWorkspaceListedAs(app, { workspace, state: "connected" });
});
