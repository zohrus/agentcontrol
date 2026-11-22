import type { AgentKind } from "@agentcontrol/protocol";

const DEFAULT_COMMANDS: Record<AgentKind, string[] | undefined> = {
  "claude-code": ["bunx", "--bun", "@agentclientprotocol/claude-agent-acp@0.109.1"],
  codex: ["bunx", "--bun", "@agentclientprotocol/codex-acp@2.9.0"],
  mock: undefined,
};

const OVERRIDE_VARIABLES: Record<AgentKind, string> = {
  "claude-code": "AGENTCONTROL_AGENT_CLAUDE_CODE_CMD",
  codex: "AGENTCONTROL_AGENT_CODEX_CMD",
  mock: "AGENTCONTROL_AGENT_MOCK_CMD",
};

const KINDS: AgentKind[] = ["claude-code", "codex", "mock"];

function parseArgv(variable: string, text: string): string[] {
  const parsed: unknown = JSON.parse(text);
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every((a) => typeof a === "string")
  ) {
    throw new Error(`${variable} must be a JSON array of strings, like ["bun", "agent.ts"]`);
  }
  return parsed;
}

/** The command line that launches this agent kind, or undefined when it is not configured. */
export function commandFor(kind: AgentKind): string[] | undefined {
  const variable = OVERRIDE_VARIABLES[kind];
  const override = process.env[variable];
  return override ? parseArgv(variable, override) : DEFAULT_COMMANDS[kind];
}

/** Agent kinds that can be launched on this machine. */
export function availableAgents(): AgentKind[] {
  return KINDS.filter((kind) => commandFor(kind) !== undefined);
}
