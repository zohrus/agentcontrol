import type { MockAgent } from "./mock-agent-script.ts";

/** The agent will reply "Done" and report 1200 input and 340 output tokens costing less than a cent: $0.004. */
export function agentWillReplyCostingFourTenthsOfACent(mockAgent: MockAgent): void {
  mockAgent.willReportUsage({
    model: "claude-haiku-4-5",
    inputTokens: 1200,
    outputTokens: 340,
    cachedReadTokens: 0,
    cachedWriteTokens: 0,
    costUsd: 0.004,
  });
  mockAgent.willReply("Done");
}
