import { afterEach, test } from "bun:test";
import { expectAgentToHaveExited } from "../support/expect/resume-edge-expectations.ts";
import { expectAgentToHaveSaidInLog } from "../support/expect/resume-expectations.ts";
import { expectSessionListedAs } from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  nextAgentCannotLoadAndReplies,
  nextAgentDiesRightAfterStarting,
} from "../support/setup/next-agent.ts";
import { relayIsKilledBetweenStoppingItsAgentsAndMarkingThem } from "../support/setup/relay-crashes.ts";
import {
  startRelayWithSessionWaitingForReply,
  startRelayWithSessionWaitingToRunNpmTest,
} from "../support/setup/relay-sessions.ts";

afterEach(cleanUpAfterTest);

test("a relay killed after stopping its agents but before marking the session leaves it interrupted", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent is waiting for approval to run `npm test`
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingToRunNpmTest();

  // ********************************************************************
  // ** WHEN the relay is stopped, killed before it marked the session, and started again
  // ********************************************************************
  await relayIsKilledBetweenStoppingItsAgentsAndMarkingThem(relay, session);

  // ********************************************************************
  // ** THEN the session is listed as interrupted, not failed
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "interrupted" });
});

test("a resumed agent that dies before its first turn leaves the session interrupted, and it can be resumed again", async () => {
  // ********************************************************************
  // ** GIVEN an interrupted session, and an agent that dies right after it starts
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingForReply("Earlier answer");
  await relay.restartsTheRelay();
  await expectSessionListedAs(relay, { session, status: "interrupted" });
  await nextAgentDiesRightAfterStarting(relay);

  // ********************************************************************
  // ** WHEN the user resumes the session and the agent dies
  // ********************************************************************
  await relay.user.resumesSession(session);
  await expectAgentToHaveExited(relay, { session, times: 2, withCode: 4 });

  // ********************************************************************
  // ** THEN the session is still interrupted
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "interrupted" });
  // AND once an agent that works is available, a message resumes it and carries on
  await nextAgentCannotLoadAndReplies(relay, "Back again");
  await relay.user.sendsMessage(session, "Go on");
  await expectAgentToHaveSaidInLog(relay, { session, text: "Back again" });
});
