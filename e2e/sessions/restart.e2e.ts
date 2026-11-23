import { afterEach, test } from "bun:test";
import {
  expectSessionHistoryToBeReplayed,
  expectSessionListedAs,
} from "../support/expect/session-expectations.ts";
import { expectNoRequestToBeWaiting } from "../support/expect/resume-expectations.ts";
import { startRelayWithSessionWaitingToRunNpmTest } from "../support/setup/relay-sessions.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithSessionWaitingForReply } from "../support/setup/relay-sessions.ts";

afterEach(cleanUpAfterTest);

test("after the relay restarts, a session that finished its turn is listed as interrupted, with its history", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent replied "Tests pass" and finished its turn
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingForReply("Tests pass");

  // ********************************************************************
  // ** WHEN the relay daemon restarts and the app follows the session from its start
  // ********************************************************************
  await relay.restartsTheRelay();
  await relay.followsSessionAfter(session, 0);

  // ********************************************************************
  // ** THEN the session is listed as interrupted, its agent being gone
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "interrupted" });
  // AND the app is given its history
  await expectSessionHistoryToBeReplayed(relay, session);
});

test("after the relay restarts, a session whose turn was open is listed as interrupted, and its request is gone", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent is waiting for approval to run `npm test`
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingToRunNpmTest();

  // ********************************************************************
  // ** WHEN the relay daemon restarts
  // ********************************************************************
  await relay.restartsTheRelay();

  // ********************************************************************
  // ** THEN the session is listed as interrupted
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "interrupted" });
  // AND the request nobody can answer any more is gone
  await expectNoRequestToBeWaiting(relay, session);
});
