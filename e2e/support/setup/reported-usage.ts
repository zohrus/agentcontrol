import type { MockAgent } from "./mock-agent-script.ts";

/** The agent will reply "Done" and report 1200 input and 340 output tokens, costing $0.02. */
export function agentWillReplyReporting1200And340Tokens(mockAgent: MockAgent): void {
  mockAgent.willReportUsage({
    model: "claude-sonnet-4-5",
    inputTokens: 1200,
    outputTokens: 340,
    cachedReadTokens: 800,
    cachedWriteTokens: 50,
    costUsd: 0.02,
  });
  mockAgent.willReply("Done");
}
