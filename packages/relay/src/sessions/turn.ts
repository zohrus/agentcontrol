import { ErrorCode, type SessionId } from "@agentcontrol/protocol";
import type { AgentProcess } from "../agents/index.ts";
import { RelayError } from "../rpc/index.ts";
import { type SessionContext, sessionInfo } from "./context.ts";
import { summarize } from "./summarize.ts";

async function whyNoAgent(ctx: SessionContext, sessionId: SessionId): Promise<RelayError> {
  await sessionInfo(ctx, sessionId);
  const summary = summarize(await ctx.log.readAfter(sessionId, 0));
  if (summary?.waitingReason === "setup-failed") {
    return new RelayError(
      ErrorCode.setupFailed,
      "The setup script failed, so this session has no agent. Fix the setup and start a new session.",
    );
  }
  return new RelayError(ErrorCode.invalidRequest, "This session's agent is not running.");
}

/** The running agent of a session, or the plain-language reason there is none. */
export async function liveAgent(ctx: SessionContext, sessionId: SessionId): Promise<AgentProcess> {
  const agent = ctx.live.get(sessionId);
  if (agent) return agent;
  throw await whyNoAgent(ctx, sessionId);
}

async function finishTurn(
  ctx: SessionContext,
  turn: { sessionId: SessionId; agent: AgentProcess; text: string },
): Promise<void> {
  try {
    const { stopReason } = await turn.agent.prompt(turn.text);
    ctx.record(turn.sessionId, { kind: "turn-ended", payload: { stopReason } });
  } catch {
    // A prompt that fails means the agent is unusable: stop it so the session reads as failed.
    await turn.agent.stop();
  }
}

/** Records the prompt, then lets the turn run in the background until the agent answers. */
export async function startTurn(
  ctx: SessionContext,
  turn: { sessionId: SessionId; agent: AgentProcess; text: string },
): Promise<void> {
  await ctx.log.append(turn.sessionId, { kind: "prompt-sent", payload: { text: turn.text } });
  void finishTurn(ctx, turn);
}
