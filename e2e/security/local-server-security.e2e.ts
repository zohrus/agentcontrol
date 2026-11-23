import { afterEach, test } from "bun:test";
import { expectSessionWaitingForApproval } from "../support/expect/app-expectations.ts";
import {
  expectAnswerToStayWithItsOwnSite,
  expectNoCrossSiteAccessHeaders,
  expectOwnClientToReachTheApp,
  expectRequestAccepted,
  expectRequestRefusedAs,
  expectTokenFileForOwnerOnly,
  expectTokenToHaveChanged,
} from "../support/expect/security-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a website that tries to approve a command is refused and the command stays pending", async () => {
  // ********************************************************************
  // ** GIVEN a session waiting for approval to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willAskToRunCommand("npm test");
  const session = await app.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(app, session);

  // ********************************************************************
  // ** WHEN a page on another website tries to approve the command
  // ********************************************************************
  const answer = await app.aWebsiteTriesTo.approveTheCommand(session);

  // ********************************************************************
  // ** THEN the app refuses it as coming from another origin
  // ********************************************************************
  expectRequestRefusedAs(answer, "forbidden-origin");
  // AND the session still waits for the user's approval
  await expectSessionWaitingForApproval(app, session);
});

test("a refusal gives no cross-site access", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a page on another website asks for the session list
  // ********************************************************************
  const answer = await app.aWebsiteTriesTo.listTheSessions();

  // ********************************************************************
  // ** THEN the answer carries no header that lets that website read it
  // ********************************************************************
  expectNoCrossSiteAccessHeaders(answer);
});

test("a request under a foreign host name is refused as DNS rebinding", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a request reaches the app under another host name, even with the token
  // ********************************************************************
  const answer = await app.aRebindingHostnameTriesTo.listTheSessions();

  // ********************************************************************
  // ** THEN the app refuses the host
  // ********************************************************************
  expectRequestRefusedAs(answer, "forbidden-host");
});

test("a request without the token is refused", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a local program asks for the session list without the token
  // ********************************************************************
  const answer = await app.aProgramWithoutTheToken.listsTheSessions();

  // ********************************************************************
  // ** THEN the app refuses it as unauthorized
  // ********************************************************************
  expectRequestRefusedAs(answer, "unauthorized");
});

test("a request with a wrong token is refused", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a local program asks for the session list with a wrong token
  // ********************************************************************
  const answer = await app.aProgramWithAWrongToken.listsTheSessions();

  // ********************************************************************
  // ** THEN the app refuses it as unauthorized
  // ********************************************************************
  expectRequestRefusedAs(answer, "unauthorized");
});

test("the app's own client with the token works, and its answers stay with their own site", async () => {
  // ********************************************************************
  // ** GIVEN the app is running and its client holds the token from the token file
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the client asks for the session list
  // ********************************************************************
  await expectOwnClientToReachTheApp(app);
  const answer = await app.aProgramWithTheToken.listsTheSessions();

  // ********************************************************************
  // ** THEN the app answers
  // ********************************************************************
  expectRequestAccepted(answer);
  // AND the answer asks browsers not to sniff it or share it across sites
  expectAnswerToStayWithItsOwnSite(answer);
});

test("the live stream refuses a client without the token", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a client without the token opens the live stream
  // ********************************************************************
  const answer = await app.aProgramWithoutTheToken.opensTheLiveStream();

  // ********************************************************************
  // ** THEN the app refuses it as unauthorized
  // ********************************************************************
  expectRequestRefusedAs(answer, "unauthorized");
});

test("the token file is readable by its owner only and changes at every start", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  const before = app.token;

  // ********************************************************************
  // ** WHEN the app is restarted
  // ********************************************************************
  await app.restartsTheApp();

  // ********************************************************************
  // ** THEN the token file is owner-only and holds a new secret
  // ********************************************************************
  await expectTokenFileForOwnerOnly(app);
  await expectTokenToHaveChanged({ dataDir: app.dataDir, before });
});

test("the config and Modify routes are refused without the token", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a program without the token reads the config, asks Modify for a change and undoes one
  // ********************************************************************
  const config = await app.aProgramWithoutTheToken.readsTheHarnessConfig();
  const change = await app.aProgramWithoutTheToken.asksTheModifyAgentToChangeTheUi();
  const undo = await app.aProgramWithoutTheToken.callsTheRecoveryPageApi();

  // ********************************************************************
  // ** THEN the app refuses each as unauthorized
  // ********************************************************************
  expectRequestRefusedAs(config, "unauthorized");
  expectRequestRefusedAs(change, "unauthorized");
  expectRequestRefusedAs(undo, "unauthorized");
});
