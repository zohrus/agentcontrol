import { agent, methods, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import type { MockAgentScript, Step, StopReason } from "./script.ts";
import { runStep, type TurnContext } from "./steps.ts";

async function runSteps(steps: readonly Step[], turn: TurnContext): Promise<StopReason> {
  for (const step of steps) {
    const stopReason = await runStep(step, turn);
    if (stopReason) return stopReason;
  }
  return "end_turn";
}

/** The `usage` of the prompt result, as the real adapters report it, when the turn reports usage. */
function usageOf(steps: readonly Step[]) {
  const report = steps.find((step) => step.kind === "reportUsage");
  if (!report) return {};
  const { inputTokens, outputTokens, cachedReadTokens, cachedWriteTokens } = report;
  const totalTokens = inputTokens + outputTokens;
  return { usage: { totalTokens, inputTokens, outputTokens, cachedReadTokens, cachedWriteTokens } };
}

export function createMockAgent(script: MockAgentScript) {
  let turnsStarted = 0;
  let cwd = process.cwd();
  let launchSettings: unknown;
  let cancel = (): void => undefined;
  const cancelled = new Promise<void>((resolve) => {
    cancel = resolve;
  });
  return agent({ name: "mock-agent" })
    .onRequest(methods.agent.initialize, () => ({
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {},
      agentInfo: { name: "mock-agent", version: "0.0.0" },
    }))
    .onRequest(methods.agent.session.new, ({ params }) => {
      cwd = params.cwd;
      launchSettings = params._meta;
      return { sessionId: "mock-session-1" };
    })
    .onNotification(methods.agent.session.cancel, () => {
      cancel();
    })
    .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
      const steps = script.turns[turnsStarted++] ?? [];
      const turn = { client, sessionId: params.sessionId, cwd, cancelled, launchSettings };
      const stopReason = await runSteps(steps, turn);
      return { stopReason, ...usageOf(steps) };
    });
}
