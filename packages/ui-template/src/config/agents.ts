import type { ConfigAgent } from "@agentcontrol/protocol";

const names: Record<ConfigAgent, string> = { "claude-code": "Claude Code", codex: "Codex" };

export const agentName = (agent: ConfigAgent): string => names[agent];

export const allAgents: readonly ConfigAgent[] = ["claude-code", "codex"];

/** Which agent reads a config file, judged by where it lives. */
export function agentOfPath(path: string): ConfigAgent {
  const isCodex = /\/\.codex\/|\/\.agents\/|\/AGENTS\.md$/.test(path);
  return isCodex ? "codex" : "claude-code";
}
