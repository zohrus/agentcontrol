import { afterEach, test } from "bun:test";
import {
  expectASessionToStillBeWorking,
  expectRelayToRunTheAppsCode,
  expectRelayToStillRunBuild,
  expectTheWorkingSessionToBeInterrupted,
} from "../support/expect/relay-build-expectations.ts";
import { expectSessionToBe } from "../support/expect/ready-session-expectations.ts";
import {
  expectWorkspaceToBe,
  expectWorkspaceToExplain,
} from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

const OTHER_CODE = "built-before-the-update";

test("a relay running other code under the same version is replaced when the app connects, and sessions can be created", async () => {
  // ********************************************************************
  // ** GIVEN a relay that runs other code than the app but has the same version, with nothing working
  // ********************************************************************
  const relayBuildId = OTHER_CODE;

  // ********************************************************************
  // ** WHEN the app starts and connects to it
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ relayBuildId, appCanReplaceTheRelay: true });

  // ********************************************************************
  // ** THEN the relay now running is the app's own
  // ********************************************************************
  await expectRelayToRunTheAppsCode(app.relay);
  // AND the user can create a session on it, with no prompt, which the old code refused
  const session = await app.user.createsSessionWithoutAPrompt();
  await expectSessionToBe(app, { session, status: "ready" });
});

test("a relay running other code with a session working is left alone, and the workspace says why and what to do", async () => {
  // ********************************************************************
  // ** GIVEN a relay that runs other code than the app, with a session whose agent is working
  // ********************************************************************
  const relayBuildId = OTHER_CODE;

  // ********************************************************************
  // ** WHEN the app starts and connects to it
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({
    relayBuildId,
    relayHasAWorkingSession: true,
    appCanReplaceTheRelay: true,
  });

  // ********************************************************************
  // ** THEN the workspace needs a relay update, and says the relay runs other code
  // ********************************************************************
  const workspace = await app.user.looksAtThisMac();
  expectWorkspaceToBe(workspace, "needs-relay-update");
  expectWorkspaceToExplain(workspace, "The relay runs other code than this app");
  // AND that one session is still working, so the relay was left running
  expectWorkspaceToExplain(workspace, "1 session is still working on it, so it was left running");
  // AND it says to restart the relay when they are done, or to use Restart relay
  expectWorkspaceToExplain(workspace, "Restart it when they are done, or use Restart relay");
  // AND the relay and its session are untouched
  await expectRelayToStillRunBuild(app.relay, OTHER_CODE);
  await expectASessionToStillBeWorking(app);
});

test("the user can restart the relay of this Mac at once, ending the sessions, which can be resumed", async () => {
  // ********************************************************************
  // ** GIVEN a workspace that needs a relay update because the old relay's session is working
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({
    relayBuildId: OTHER_CODE,
    relayHasAWorkingSession: true,
    appCanReplaceTheRelay: true,
  });
  expectWorkspaceToBe(await app.user.looksAtThisMac(), "needs-relay-update");

  // ********************************************************************
  // ** WHEN the user restarts the relay
  // ********************************************************************
  await app.user.restartsTheRelayOfThisMac();

  // ********************************************************************
  // ** THEN the relay running is the app's own
  // ********************************************************************
  await expectRelayToRunTheAppsCode(app.relay);
  // AND the session that was working is shown as interrupted
  await expectTheWorkingSessionToBeInterrupted(app);
});
