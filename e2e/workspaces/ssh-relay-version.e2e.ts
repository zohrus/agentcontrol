import { afterEach, test } from "bun:test";
import {
  expectChecklistStepToBe,
  expectWorkspaceListedAs,
  expectWorkspaceToBe,
  expectWorkspaceToExplain,
} from "../support/expect/ssh-expectations.ts";
import {
  expectHostRelayToBeUntouched,
  expectHostRelayToHaveBeenReplaced,
} from "../support/expect/ssh-host-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startOldRelayOnHost } from "../support/setup/ssh-old-relay.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

afterEach(cleanUpAfterTest);

test("a relay of another version on the host that has nothing running is replaced, and the app connects", async () => {
  // ********************************************************************
  // ** GIVEN the host runs a relay of an older version with no session working
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  const old = await startOldRelayOnHost(host, "0.0.1");

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is connected
  // ********************************************************************
  expectWorkspaceToBe(workspace, "connected");
  // AND the host's relay is a new one, started from the app's version
  await expectHostRelayToHaveBeenReplaced(host, old);
});

test("an old relay with a session still working is left alone, and the workspace says it needs an update", async () => {
  // ********************************************************************
  // ** GIVEN the host runs a relay of an older version whose agent is working
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  const old = await startOldRelayOnHost(host, "0.0.1");
  await old.startsWorkingSession();

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace says it needs a relay update, and why
  // ********************************************************************
  expectWorkspaceToBe(workspace, "needs-relay-update");
  expectWorkspaceToExplain(workspace, "still working");
  // AND the old relay keeps running with its session
  await expectHostRelayToBeUntouched(host, old);
});

test("an old relay is replaced once its working session ends, and the workspace connects", async () => {
  // ********************************************************************
  // ** GIVEN a workspace that needs a relay update because the old relay's agent is working
  // ********************************************************************
  const { host, user, app } = await startAppWithSshHost();
  const old = await startOldRelayOnHost(host, "0.0.1");
  const working = await old.startsWorkingSession();
  const workspace = await user.addsTheHost();
  expectWorkspaceToBe(workspace, "needs-relay-update");

  // ********************************************************************
  // ** WHEN the old session's work ends
  // ********************************************************************
  await old.endsTheWork(working);

  // ********************************************************************
  // ** THEN the workspace connects
  // ********************************************************************
  await expectWorkspaceListedAs(app, { workspace, state: "connected" });
  // AND the host's relay is a new one
  await expectHostRelayToHaveBeenReplaced(host, old);
});

test("the user can restart a busy old relay at once instead of waiting for its sessions", async () => {
  // ********************************************************************
  // ** GIVEN a workspace that needs a relay update because the old relay's agent is working
  // ********************************************************************
  const { host, user, app } = await startAppWithSshHost();
  const old = await startOldRelayOnHost(host, "0.0.1");
  await old.startsWorkingSession();
  const workspace = await user.addsTheHost();
  expectWorkspaceToBe(workspace, "needs-relay-update");

  // ********************************************************************
  // ** WHEN the user restarts the relay
  // ********************************************************************
  await user.restartsTheRelayOn(workspace);

  // ********************************************************************
  // ** THEN the workspace connects to a relay of the app's version
  // ********************************************************************
  await expectWorkspaceListedAs(app, { workspace, state: "connected" });
  await expectHostRelayToHaveBeenReplaced(host, old);
});

test("the checklist says the relay cannot run while an old relay's session is still working", async () => {
  // ********************************************************************
  // ** GIVEN a workspace that needs a relay update because the old relay's agent is working
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  const old = await startOldRelayOnHost(host, "0.0.1");
  await old.startsWorkingSession();
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const steps = await user.checksTheWorkspace(workspace);

  // ********************************************************************
  // ** THEN the relay step failed, saying a session is still working
  // ********************************************************************
  expectChecklistStepToBe(steps, { id: "relay", status: "failed", saying: "still working" });
  // AND the relay was installed
  expectChecklistStepToBe(steps, { id: "install", status: "ok" });
});
