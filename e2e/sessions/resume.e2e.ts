import { afterEach, test } from "bun:test";
import { ErrorCode } from "@agentcontrol/protocol";
import { expectRefusal } from "../support/expect/refusal-expectations.ts";
import {
  expectAgentTextInLogTimes,
  expectAgentToHaveSaidInLog,
  expectInterruptionToHaveDropped,
  expectNoRequestToBeWaiting,
  expectResumeNote,
} from "../support/expect/resume-expectations.ts";
import { expectSessionListedAs } from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { relayIsKilledWhileTheAgentWaitsForApproval } from "../support/setup/relay-crashes.ts";
import {
  startRelayWithSessionWaitingForReply,
  startRelayWithSessionWhoseAgentDied,
  startRelayWithSessionWaitingToRunNpmTest,
} from "../support/setup/relay-sessions.ts";
import type { RunningRelay } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

/** The relay stopped and started again while the session's agent was alive; the session was interrupted. */
async function interruptedSessionThatSaid(earlier: string) {
  const { relay, session } = await startRelayWithSessionWaitingForReply(earlier);
  await relay.restartsTheRelay();
  await expectSessionListedAs(relay, { session, status: "interrupted" });
  return { relay, session };
}

/** The next agent starts from this script; it can load the earlier session when `canLoad` is set. */
async function nextAgentWill(
  relay: RunningRelay,
  plan: { reply: string; canLoad?: string[]; loadFails?: boolean },
) {
  relay.mockAgent.startsNewScript();
  if (plan.canLoad) relay.mockAgent.canLoadEarlierSession(plan.canLoad);
  if (plan.loadFails) relay.mockAgent.failsToLoadEarlierSession();
  relay.mockAgent.willReply(plan.reply);
  await relay.mockAgent.writeScript();
}

test("after the relay was killed while the agent waited for approval, the session is interrupted and its request is gone", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent is waiting for approval to run `npm test`
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingToRunNpmTest();

  // ********************************************************************
  // ** WHEN the relay is killed and starts again
  // ********************************************************************
  await relayIsKilledWhileTheAgentWaitsForApproval(relay, session);

  // ********************************************************************
  // ** THEN the session is listed as interrupted
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "interrupted" });
  // AND the request nobody can answer any more is gone, and the log says it was dropped
  await expectNoRequestToBeWaiting(relay, session);
  await expectInterruptionToHaveDropped(relay, { session, requests: 1 });
});

test("resuming an interrupted session continues it with its history restored and not logged again", async () => {
  // ********************************************************************
  // ** GIVEN an interrupted session whose agent said "Earlier answer", and an agent that can load it
  // ********************************************************************
  const { relay, session } = await interruptedSessionThatSaid("Earlier answer");
  await nextAgentWill(relay, { reply: "Carrying on", canLoad: ["Earlier answer"] });

  // ********************************************************************
  // ** WHEN the user resumes the session and asks it to go on
  // ********************************************************************
  await relay.user.resumesSession(session);
  await relay.user.sendsMessage(session, "Go on");

  // ********************************************************************
  // ** THEN the agent carries on in the same session
  // ********************************************************************
  await expectAgentToHaveSaidInLog(relay, { session, text: "Carrying on" });
  // AND the log says the agent remembers the earlier work
  await expectResumeNote(relay, { session, contextRestored: true, saying: "remembers" });
  // AND the history the agent replayed was not logged a second time
  await expectAgentTextInLogTimes(relay, { session, text: "Earlier answer", times: 1 });
});

test("an agent that cannot load the earlier session is resumed with a note that its context was not restored", async () => {
  // ********************************************************************
  // ** GIVEN an interrupted session, and an agent that cannot load an earlier session
  // ********************************************************************
  const { relay, session } = await interruptedSessionThatSaid("Earlier answer");
  await nextAgentWill(relay, { reply: "Starting over" });

  // ********************************************************************
  // ** WHEN the user resumes the session and asks it to go on
  // ********************************************************************
  await relay.user.resumesSession(session);
  await relay.user.sendsMessage(session, "Go on");

  // ********************************************************************
  // ** THEN the log says earlier context was not restored, and why
  // ********************************************************************
  await expectResumeNote(relay, { session, contextRestored: false, saying: "cannot load" });
  // AND the new agent answers
  await expectAgentToHaveSaidInLog(relay, { session, text: "Starting over" });
});

test("an agent whose load of the earlier session fails is resumed with a fresh conversation and a note", async () => {
  // ********************************************************************
  // ** GIVEN an interrupted session, and an agent that offers to load it but fails
  // ********************************************************************
  const { relay, session } = await interruptedSessionThatSaid("Earlier answer");
  await nextAgentWill(relay, { reply: "Starting over", loadFails: true });

  // ********************************************************************
  // ** WHEN the user resumes the session
  // ********************************************************************
  await relay.user.resumesSession(session);

  // ********************************************************************
  // ** THEN the log says earlier context was not restored, because loading failed
  // ********************************************************************
  await expectResumeNote(relay, { session, contextRestored: false, saying: "could not load" });
});

test("sending a message to an interrupted session resumes it first", async () => {
  // ********************************************************************
  // ** GIVEN an interrupted session
  // ********************************************************************
  const { relay, session } = await interruptedSessionThatSaid("Earlier answer");
  await nextAgentWill(relay, { reply: "Carrying on", canLoad: ["Earlier answer"] });

  // ********************************************************************
  // ** WHEN the user just sends a message, without resuming
  // ********************************************************************
  await relay.user.sendsMessage(session, "Go on");

  // ********************************************************************
  // ** THEN the agent answers it
  // ********************************************************************
  await expectAgentToHaveSaidInLog(relay, { session, text: "Carrying on" });
  // AND the session was resumed on the way
  await expectResumeNote(relay, { session, contextRestored: true, saying: "remembers" });
});

test("an archived session cannot be resumed", async () => {
  // ********************************************************************
  // ** GIVEN an interrupted session that the user archived
  // ********************************************************************
  const { relay, session } = await interruptedSessionThatSaid("Earlier answer");
  await relay.user.archivesSession(session);

  // ********************************************************************
  // ** WHEN the user tries to resume it
  // ********************************************************************
  const outcome = await relay.user.triesToResumeSession(session);

  // ********************************************************************
  // ** THEN the relay refuses, saying the session was archived
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.sessionArchived, saying: "archived" });
});

test("a session whose agent is running cannot be resumed", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent is running and waiting for a reply
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingForReply("Tests pass");

  // ********************************************************************
  // ** WHEN the user tries to resume it
  // ********************************************************************
  const outcome = await relay.user.triesToResumeSession(session);

  // ********************************************************************
  // ** THEN the relay refuses, saying the agent is already running
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.invalidParams, saying: "already running" });
});

test("a session whose agent failed on its own cannot be resumed", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent died in the middle of its turn
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWhoseAgentDied();

  // ********************************************************************
  // ** WHEN the user tries to resume it
  // ********************************************************************
  const outcome = await relay.user.triesToResumeSession(session);

  // ********************************************************************
  // ** THEN the relay refuses, saying the session was not interrupted
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.invalidParams, saying: "not interrupted" });
});
