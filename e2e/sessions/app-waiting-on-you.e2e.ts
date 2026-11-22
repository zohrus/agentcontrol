import { afterEach, test } from "bun:test";
import {
  expectApprovalRequestToRunCommand,
  expectLiveStreamDeliveredAgentReply,
  expectSessionWaitingForApproval,
  expectSessionWaitingForReply,
} from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a session that asks to run a command is listed as waiting for approval", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  // AND the agent will ask permission to run `npm test` on its first turn
  app.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session asking to add rate limiting
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session list flags the session as waiting for approval
  // ********************************************************************
  await expectSessionWaitingForApproval(app, session);
  // AND the pending request names the `npm test` command
  await expectApprovalRequestToRunCommand(app, { session, command: "npm test" });
});

test("allowing the command lets the agent finish and the session waits for a reply", async () => {
  // ********************************************************************
  // ** GIVEN a session waiting for approval to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willAskToRunCommand("npm test");
  app.mockAgent.willReply("Tests pass");
  const session = await app.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(app, session);

  // ********************************************************************
  // ** WHEN the user allows the command
  // ********************************************************************
  await app.user.allowsTheCommand(session);

  // ********************************************************************
  // ** THEN the session waits for the user's next message
  // ********************************************************************
  await expectSessionWaitingForReply(app, session);
  // AND the agent's reply was delivered
  await expectLiveStreamDeliveredAgentReply(app, { session, text: "Tests pass" });
});

test("the live stream delivers the agent's reply while the session still waits for approval", async () => {
  // ********************************************************************
  // ** GIVEN an agent that replies first and then asks to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("Let me run the tests");
  app.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Check the build" });

  // ********************************************************************
  // ** THEN the live stream delivers the agent's reply as it happens
  // ********************************************************************
  await expectLiveStreamDeliveredAgentReply(app, { session, text: "Let me run the tests" });
  // AND the session is still waiting for approval
  await expectSessionWaitingForApproval(app, session);
});
