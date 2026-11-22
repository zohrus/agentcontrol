import { afterEach, test } from "bun:test";
import { ErrorCode } from "@agentcontrol/protocol";
import { expectRefusal } from "../support/expect/refusal-expectations.ts";
import {
  expectPendingRequestWithdrawn,
  expectSessionRunning,
  expectSessionWaitingForApproval,
  expectSessionWaitingForReply,
  expectSessionWaitingForSetupFix,
} from "../support/expect/session-expectations.ts";
import { expectNoCommandToHaveRun } from "../support/expect/turn-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a message to a session whose agent is gone is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent finished its turn, and then the relay restarted
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReply("Tests pass");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForReply(relay, session);
  await relay.restartsTheRelay();

  // ********************************************************************
  // ** WHEN the user sends the session a message
  // ********************************************************************
  const outcome = await relay.user.triesToSendMessage(session, "And again?");

  // ********************************************************************
  // ** THEN the relay says the agent is not running
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.invalidRequest, saying: "agent is not running" });
});

test("a message to a session whose setup failed is refused with a hint to fix the setup", async () => {
  // ********************************************************************
  // ** GIVEN a repo whose setup script fails, and a session started on it
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  await relay.repoSetupScriptIs("exit 1");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForSetupFix(relay, session);

  // ********************************************************************
  // ** WHEN the user sends the session a message
  // ********************************************************************
  const outcome = await relay.user.triesToSendMessage(session, "Try anyway");

  // ********************************************************************
  // ** THEN the relay says the setup script failed
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.setupFailed, saying: "setup script failed" });
});

test("answering a request that is not waiting is refused", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent is waiting for approval to run `npm test`
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);

  // ********************************************************************
  // ** WHEN the user answers a request the agent never made
  // ********************************************************************
  const outcome = await relay.user.triesToAnswerARequestThatIsNotWaiting(session);

  // ********************************************************************
  // ** THEN the relay says that request is not waiting for an answer
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.invalidParams, saying: "no longer waiting" });
});

test("a session whose agent is in the middle of a turn is listed as running", async () => {
  // ********************************************************************
  // ** GIVEN an agent whose turn stays open until it is cancelled
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willWaitUntilCancelled();

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Refactor everything" });

  // ********************************************************************
  // ** THEN the session list shows it as running
  // ********************************************************************
  await expectSessionRunning(relay, session);
});

test("cancelling a turn that waits for approval withdraws the request", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent is waiting for approval to run `npm test`
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);

  // ********************************************************************
  // ** WHEN the user cancels the turn
  // ********************************************************************
  await relay.user.cancelsTheTurn(session);

  // ********************************************************************
  // ** THEN the pending request is withdrawn
  // ********************************************************************
  await expectPendingRequestWithdrawn(relay, session);
  // AND the command was not run
  await relay.user.waitsForTheAgentToFinish(session);
  expectNoCommandToHaveRun(relay, session);
});
