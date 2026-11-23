import { join } from "node:path";
import { type RunningRelay, startRelayWithLocalRepo } from "./start-relay.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

/**
 * A relay whose "claude-code" agent is the mock agent, behaving like the Claude Code adapter: it
 * offers the adapter's permission modes and starts in `startsIn`.
 */
export async function startRelayWithClaudeCodeLikeAgent(options: {
  startsIn: string;
}): Promise<RunningRelay> {
  const relay = await startRelayWithLocalRepo({
    env: { AGENTCONTROL_AGENT_CLAUDE_CODE_CMD: JSON.stringify(["bun", mockAgentMain]) },
  });
  relay.mockAgent.startsInMode(options.startsIn);
  return relay;
}
