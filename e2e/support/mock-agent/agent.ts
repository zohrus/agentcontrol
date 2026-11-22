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

export function createMockAgent(script: MockAgentScript) {
  let turnsStarted = 0;
  let cwd = process.cwd();
  return agent({ name: "mock-agent" })
    .onRequest(methods.agent.initialize, () => ({
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {},
      agentInfo: { name: "mock-agent", version: "0.0.0" },
    }))
    .onRequest(methods.agent.session.new, ({ params }) => {
      cwd = params.cwd;
      return { sessionId: "mock-session-1" };
    })
    .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
      const steps = script.turns[turnsStarted++] ?? [];
      const stopReason = await runSteps(steps, { client, sessionId: params.sessionId, cwd });
      return { stopReason };
    });
}
