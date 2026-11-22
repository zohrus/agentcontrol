import { afterEach, test } from "bun:test";
import {
  expectListedAsTurnRunning,
  expectListedWithNoPendingRequest,
  expectListedWithRequestToRunCommand,
} from "../support/expect/summary-expectations.ts";
import {
  expectSessionListedAs,
  expectSessionWaitingForApproval,
  expectSessionWaitingForReply,
} from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { forSession } from "../support/setup/session-events.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a session waiting for approval lists the request with its command and options", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask permission to run `npm test`
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);

  // ********************************************************************
  // ** THEN the session's list row holds the request to run `npm test`
  // ********************************************************************
  await expectListedWithRequestToRunCommand(relay, { session, command: "npm test" });
});

test("answering the request removes it from the session's list row", async () => {
  // ********************************************************************
  // ** GIVEN a session waiting for approval to run `npm test`
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");
  relay.mockAgent.willReply("Tests pass");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);

  // ********************************************************************
  // ** WHEN the user allows the command
  // ********************************************************************
  await relay.user.allowsTheCommand(session);
  await expectSessionWaitingForReply(relay, session);

  // ********************************************************************
  // ** THEN the list row holds no request
  // ********************************************************************
  await expectListedWithNoPendingRequest(relay, session);
});

test("the list row shows a turn running while the agent works and none after the turn ends", async () => {
  // ********************************************************************
  // ** GIVEN an agent that works until the user cancels
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willWaitUntilCancelled();

  // ********************************************************************
  // ** WHEN the user starts a session and the agent has its prompt
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Refactor the server" });
  await relay.events.waitFor(forSession(session, "prompt-sent"), "expected the agent's prompt");

  // ********************************************************************
  // ** THEN the list row shows a turn running
  // ********************************************************************
  await expectListedAsTurnRunning(relay, { session, running: true });

  // ********************************************************************
  // ** WHEN the user cancels and the turn ends
  // ********************************************************************
  await relay.user.cancelsTheTurn(session);
  await relay.user.waitsForTheAgentToFinish(session);

  // ********************************************************************
  // ** THEN the list row shows no turn running
  // ********************************************************************
  await expectListedAsTurnRunning(relay, { session, running: false });
});

test("after the relay restarts, a session that was waiting for approval has no request and has failed", async () => {
  // ********************************************************************
  // ** GIVEN a session waiting for approval to run `npm test`
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);

  // ********************************************************************
  // ** WHEN the relay daemon restarts, which ends the agent
  // ********************************************************************
  await relay.restartsTheRelay();

  // ********************************************************************
  // ** THEN the session is listed as failed, with no request nobody can answer and no turn running
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "failed" });
  await expectListedWithNoPendingRequest(relay, session);
  await expectListedAsTurnRunning(relay, { session, running: false });
});
