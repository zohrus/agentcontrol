import { afterEach, test } from "bun:test";
import { expectAgentToFailToStartBecause } from "../support/expect/agent-start-expectations.ts";
import {
  expectPendingRequestToRunCommand,
  expectSessionWaitingForApproval,
} from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithClaudeCodeLikeAgent } from "../support/setup/claude-code-like-agent.ts";

afterEach(cleanUpAfterTest);

test("a Claude Code session that starts in auto mode is switched to Manual, so it asks before running a command", async () => {
  // ********************************************************************
  // ** GIVEN a Claude Code adapter that starts in auto mode, where it never asks
  // ********************************************************************
  const relay = await startRelayWithClaudeCodeLikeAgent({ startsIn: "auto" });
  // AND the agent will run `npm test` on its first turn
  relay.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Run the tests", agent: "claude-code" });

  // ********************************************************************
  // ** THEN the session waits for approval to run `npm test`
  // ********************************************************************
  await expectSessionWaitingForApproval(relay, session);
  await expectPendingRequestToRunCommand(relay, session, "npm test");
});

test("a Claude Code session whose agent refuses to switch to Manual does not start, and says so", async () => {
  // ********************************************************************
  // ** GIVEN a Claude Code adapter that starts in auto mode and refuses to change it
  // ********************************************************************
  const relay = await startRelayWithClaudeCodeLikeAgent({ startsIn: "auto" });
  relay.mockAgent.refusesToChangeMode();

  // ********************************************************************
  // ** WHEN the user starts a Claude Code session
  // ********************************************************************
  const session = await relay.user.startsSession({ prompt: "Run the tests", agent: "claude-code" });

  // ********************************************************************
  // ** THEN the agent fails to start, because it would otherwise never ask before acting
  // ********************************************************************
  await expectAgentToFailToStartBecause(relay, {
    session,
    reason: 'the agent would not switch to its "default" mode',
  });
});
