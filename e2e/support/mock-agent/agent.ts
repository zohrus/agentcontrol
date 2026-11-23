import { agent, methods, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { createModes } from "./modes.ts";
import type { MockAgentScript, Step, StopReason } from "./script.ts";
import { runStep, type TurnContext } from "./steps.ts";

async function runSteps(steps: readonly Step[], turn: TurnContext): Promise<StopReason> {
  for (const step of steps) {
    const stopReason = await runStep(step, turn);
    if (stopReason) return stopReason;
  }
  return "end_turn";
}

/**
 * The `usage` and `_meta.quota` of the prompt result, as Claude reports them when the turn reports
 * usage. A cancelled turn reports `usage` as zeros but `_meta.quota` keeps the real numbers.
 */
function usageOf(steps: readonly Step[], stopReason: StopReason) {
  const report = steps.find((step) => step.kind === "reportUsage");
  if (!report) return {};
  const { inputTokens, outputTokens, cachedReadTokens, cachedWriteTokens } = report;
  const totalTokens = inputTokens + outputTokens;
  const spent = { totalTokens, inputTokens, outputTokens, cachedReadTokens, cachedWriteTokens };
  const none = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedReadTokens: 0,
    cachedWriteTokens: 0,
  };
  const token_count = {
    totalTokens: totalTokens + cachedReadTokens + cachedWriteTokens,
    inputTokens,
    outputTokens,
    cachedInputTokens: cachedReadTokens,
    cachedWriteTokens,
  };
  const quota = { token_count, model_usage: [{ model: report.model, token_count }] };
  return { usage: stopReason === "cancelled" ? none : spent, _meta: { quota } };
}

interface Session {
  cwd: string;
  launchSettings: unknown;
}

function whenCancelled(): { cancelled: Promise<void>; cancel: () => void } {
  let cancel = (): void => undefined;
  const cancelled = new Promise<void>((resolve) => {
    cancel = resolve;
  });
  return { cancelled, cancel };
}

const INITIALIZED = {
  protocolVersion: PROTOCOL_VERSION,
  agentCapabilities: {},
  agentInfo: { name: "mock-agent", version: "0.0.0" },
};

export function createMockAgent(script: MockAgentScript) {
  let turnsStarted = 0;
  const session: Session = { cwd: process.cwd(), launchSettings: undefined };
  const modes = createModes(script.startsInMode);
  const { cancelled, cancel } = whenCancelled();
  return agent({ name: "mock-agent" })
    .onRequest(methods.agent.initialize, () => INITIALIZED)
    .onRequest(methods.agent.session.new, ({ params }) => {
      session.cwd = params.cwd;
      session.launchSettings = params._meta;
      return { sessionId: "mock-session-1", ...modes.offered() };
    })
    .onRequest(methods.agent.session.setMode, ({ params }) => {
      if (script.refusesModeChange) throw new Error("Changing the mode is not allowed here");
      modes.switchTo(params.modeId);
      return {};
    })
    .onNotification(methods.agent.session.cancel, cancel)
    .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
      const steps = script.turns[turnsStarted++] ?? [];
      const { sessionId } = params;
      const asksBeforeActing = modes.asksBeforeActing();
      const turn = { client, sessionId, cancelled, asksBeforeActing, ...session };
      const stopReason = await runSteps(steps, turn);
      return { stopReason, ...usageOf(steps, stopReason) };
    });
}
