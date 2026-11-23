import { afterEach, test } from "bun:test";
import {
  expectChecklistStepToBe,
  expectChecklistToPass,
  expectWorkspaceToBe,
  expectWorkspaceToExplain,
} from "../support/expect/ssh-expectations.ts";
import { expectRelayInstalledOnHost } from "../support/expect/ssh-host-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

afterEach(cleanUpAfterTest);

test("adding an ssh workspace installs the relay on the host and connects", async () => {
  // ********************************************************************
  // ** GIVEN the app is running and another machine can be reached over ssh
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();

  // ********************************************************************
  // ** WHEN the user adds that machine as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is connected
  // ********************************************************************
  expectWorkspaceToBe(workspace, "connected");
  // AND the relay of the app's version was installed on the host
  await expectRelayInstalledOnHost(host);
});

test("the checklist of an ssh workspace passes every step, agents included", async () => {
  // ********************************************************************
  // ** GIVEN an ssh workspace that was added and is connected
  // ********************************************************************
  const { user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const steps = await user.checksTheWorkspace(workspace);

  // ********************************************************************
  // ** THEN every step of the checklist passed
  // ********************************************************************
  expectChecklistToPass(steps, [
    "connect",
    "platform",
    "install",
    "relay",
    "os",
    "disk",
    "git",
    "gitIdentity",
    "agent-claude-code",
    "agent-codex",
    "agent-mock",
    "repos",
  ]);
});

test("a host for which the app has no relay binary is offline, and says so", async () => {
  // ********************************************************************
  // ** GIVEN an app that has no relay binary to install on the host
  // ********************************************************************
  const { user } = await startAppWithSshHost({ relayBinaryMissing: true });

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is offline and says there is no relay for the host's system
  // ********************************************************************
  expectWorkspaceToBe(workspace, "offline");
  expectWorkspaceToExplain(workspace, "has no relay for linux");
});

test("the checklist says the relay could not be installed and skips what needs it", async () => {
  // ********************************************************************
  // ** GIVEN an ssh workspace for which the app has no relay binary
  // ********************************************************************
  const { user } = await startAppWithSshHost({ relayBinaryMissing: true });
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const steps = await user.checksTheWorkspace(workspace);

  // ********************************************************************
  // ** THEN reaching the host worked and installing the relay failed
  // ********************************************************************
  expectChecklistStepToBe(steps, { id: "connect", status: "ok" });
  expectChecklistStepToBe(steps, {
    id: "install",
    status: "failed",
    saying: "has no relay for linux",
  });
  // AND the relay step was skipped
  expectChecklistStepToBe(steps, { id: "relay", status: "skipped" });
});
