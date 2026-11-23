import { afterEach, setDefaultTimeout, test } from "bun:test";
import {
  expectAnnouncementToSay,
  expectSetupToHaveAnnounced,
  startedAndThenOk,
} from "../support/expect/setup-progress-expectations.ts";
import { expectWorkspaceToBe } from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { watchesTheSetupSteps } from "../support/setup/setup-progress.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("adding a host announces each setup step as it starts and ends, and ends connected", async () => {
  // ********************************************************************
  // ** GIVEN a host, and a program listening to the app's live stream for this setup
  // ********************************************************************
  const { app, user } = await startAppWithSshHost();
  const steps = await watchesTheSetupSteps(app, "adding-the-host");

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHostAnnouncingTheSteps("adding-the-host");

  // ********************************************************************
  // ** THEN every step was announced as started and then ok, in order
  // ********************************************************************
  await expectSetupToHaveAnnounced(
    steps,
    startedAndThenOk("connect", "platform", "install", "relay"),
  );
  // AND the workspace is connected
  expectWorkspaceToBe(workspace, "connected");
});

test("adding a host that cannot be reached stops at the connect step and says why", async () => {
  // ********************************************************************
  // ** GIVEN a host that refuses connections, and a program listening to the live stream
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  host.network.goesDown();
  const steps = await watchesTheSetupSteps(app, "adding-the-lost-host");

  // ********************************************************************
  // ** WHEN the user adds the host as a workspace
  // ********************************************************************
  await user.addsTheHostAnnouncingTheSteps("adding-the-lost-host");

  // ********************************************************************
  // ** THEN the setup announced the connect step and that it failed, and nothing after it
  // ********************************************************************
  await expectSetupToHaveAnnounced(steps, ["connect:started", "connect:failed"]);
  // AND the failure says that the host refused the connection
  expectAnnouncementToSay(steps, {
    step: "connect",
    state: "failed",
    saying: "refused the connection",
  });
});

test("checking a workspace announces the steps of the checklist, the agents and repositories last", async () => {
  // ********************************************************************
  // ** GIVEN a connected ssh workspace, and a program listening to the live stream
  // ********************************************************************
  const { app, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  const steps = await watchesTheSetupSteps(app, "checking-the-host");

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  await user.checksTheWorkspaceAnnouncingTheSteps(workspace, "checking-the-host");

  // ********************************************************************
  // ** THEN every step was announced as started and then ok, in order
  // ********************************************************************
  const everyStep = ["connect", "platform", "install", "relay", "agents", "repos"];
  await expectSetupToHaveAnnounced(steps, startedAndThenOk(...everyStep));
});
