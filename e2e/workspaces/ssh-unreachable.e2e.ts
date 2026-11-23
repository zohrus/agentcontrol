import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import { expectAppToRefuse } from "../support/expect/app-refusal-expectations.ts";
import {
  expectChecklistStepToBe,
  expectRefusalToSay,
  expectWorkspaceListedAs,
  expectWorkspaceToBe,
  expectWorkspaceToExplain,
} from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("an unreachable host shows as offline with a reason in plain words", async () => {
  // ********************************************************************
  // ** GIVEN a host that cannot be reached over the network
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  host.network.goesDown();

  // ********************************************************************
  // ** WHEN the user adds it as a workspace
  // ********************************************************************
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** THEN the workspace is offline and says that the machine refused the connection
  // ********************************************************************
  expectWorkspaceToBe(workspace, "offline");
  expectWorkspaceToExplain(workspace, "refused the connection");
});

test("an offline workspace does not hold back the app or the other workspaces", async () => {
  // ********************************************************************
  // ** GIVEN an ssh workspace that is offline
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  host.network.goesDown();
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** WHEN the user starts a session on this Mac
  // ********************************************************************
  app.mockAgent.willReply("Still working here");
  const session = await app.user.startsSession({ prompt: "Work locally" });

  // ********************************************************************
  // ** THEN the session runs and waits for a reply
  // ********************************************************************
  await expectSessionWaitingForReply(app, session);
  // AND starting a session on the offline workspace is refused with the reason
  const refused = await user.triesToStartSessionOn(workspace, { prompt: "Work remotely" });
  expectAppToRefuse(refused, { status: 503, code: "relay-unavailable" });
  expectRefusalToSay(refused, "is offline");
});

test("an app that starts while a saved host is unreachable comes up, and connects when the host is back", async () => {
  // ********************************************************************
  // ** GIVEN a saved ssh workspace whose host has become unreachable
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.network.goesDown();

  // ********************************************************************
  // ** WHEN the app is restarted, and the host comes back
  // ********************************************************************
  await app.restartsTheApp();
  host.network.comesBack();

  // ********************************************************************
  // ** THEN the app connects to the workspace on its own
  // ********************************************************************
  await expectWorkspaceListedAs(app, { workspace, state: "connected" });
});

test("the checklist of an unreachable host says it could not connect and skips the rest", async () => {
  // ********************************************************************
  // ** GIVEN an ssh workspace whose host has become unreachable
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.network.goesDown();

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const steps = await user.checksTheWorkspace(workspace);

  // ********************************************************************
  // ** THEN connecting failed, saying the machine refused the connection
  // ********************************************************************
  expectChecklistStepToBe(steps, {
    id: "connect",
    status: "failed",
    saying: "refused the connection",
  });
  // AND the steps that need the host were skipped
  expectChecklistStepToBe(steps, { id: "install", status: "skipped" });
  expectChecklistStepToBe(steps, { id: "relay", status: "skipped" });
});
