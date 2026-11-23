import { afterEach, test } from "bun:test";
import { expectSessionWaitingForReply } from "../support/expect/session-expectations.ts";
import { expectTurnToEndWithStopReason } from "../support/expect/turn-expectations.ts";
import { expectOneTurnOfUsage } from "../support/expect/usage-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

const reported = {
  model: "claude-sonnet-4-5",
  inputTokens: 1200,
  outputTokens: 340,
  cachedReadTokens: 800,
  cachedWriteTokens: 50,
  costUsd: 0.02,
};

test("a finished turn reports its token usage", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will reply and report 1200 input and 340 output tokens
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReportUsage(reported);
  relay.mockAgent.willReply("Done");

  // ********************************************************************
  // ** WHEN the user starts a session and its turn finishes
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  await expectSessionWaitingForReply(relay, session);

  // ********************************************************************
  // ** THEN the relay reports one row of usage with those tokens and the model
  // ********************************************************************
  const usage = {
    model: "claude-sonnet-4-5",
    inputTokens: 1200,
    outputTokens: 340,
    cacheReadTokens: 800,
    cacheWriteTokens: 50,
  };
  await expectOneTurnOfUsage(relay, { session, usage });
});

test("a cancelled turn still reports the tokens it used, which the agent lists only in its quota", async () => {
  // ********************************************************************
  // ** GIVEN an agent that reports 1200 input and 340 output tokens, then waits to be cancelled
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReportUsage(reported);
  relay.mockAgent.willWaitUntilCancelled();
  const session = await relay.user.startsSession({ prompt: "Tidy up the imports" });

  // ********************************************************************
  // ** WHEN the user cancels the turn
  // ********************************************************************
  await relay.user.cancelsTheTurn(session);
  await expectTurnToEndWithStopReason(relay, { session, stopReason: "cancelled" });

  // ********************************************************************
  // ** THEN the relay reports one row of usage with those tokens and the model
  // ********************************************************************
  const usage = {
    model: "claude-sonnet-4-5",
    inputTokens: 1200,
    outputTokens: 340,
    cacheReadTokens: 800,
    cacheWriteTokens: 50,
  };
  await expectOneTurnOfUsage(relay, { session, usage });
});
