import { afterEach, test } from "bun:test";
import {
  expectSessionHistoryToBeReplayed,
  expectSessionListedAs,
  expectSessionWaitingForApproval,
  expectSessionWaitingForReply,
} from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("after the relay restarts, a session that finished its turn is still listed with its history", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent replied "Tests pass" and finished its turn
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReply("Tests pass");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForReply(relay, session);

  // ********************************************************************
  // ** WHEN the relay daemon restarts and the app follows the session from its start
  // ********************************************************************
  await relay.restartsTheRelay();
  await relay.followsSessionAfter(session, 0);

  // ********************************************************************
  // ** THEN the session is listed as idle, its agent being gone
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "idle" });
  // AND the app is given its history
  await expectSessionHistoryToBeReplayed(relay, session);
});

test("after the relay restarts, a session whose turn was open is listed as failed", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent is waiting for approval to run `npm test`
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);

  // ********************************************************************
  // ** WHEN the relay daemon restarts
  // ********************************************************************
  await relay.restartsTheRelay();

  // ********************************************************************
  // ** THEN the session is listed as failed
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "failed" });
});
