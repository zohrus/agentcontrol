import { afterEach, test } from "bun:test";
import { ErrorCode } from "@agentcontrol/protocol";
import { expectRefusal } from "../support/expect/refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  startRelayWithSessionWaitingForReply,
  startRelayWithSessionWhoseAgentDied,
} from "../support/setup/relay-sessions.ts";

afterEach(cleanUpAfterTest);

/** The relay stopped and started again while the session's agent was alive; the session was interrupted. */
async function interruptedSessionThatSaid(earlier: string) {
  const { relay, session } = await startRelayWithSessionWaitingForReply(earlier);
  await relay.restartsTheRelay();
  return { relay, session };
}

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
