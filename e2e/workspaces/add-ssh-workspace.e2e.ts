import { afterEach, test } from "bun:test";
import {
  expectChecklistToPass,
  expectRelayInstalledOnHost,
  expectWorkspaceToBe,
} from "../support/expect/ssh-expectations.ts";
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
