import type { AgentKind } from "@agentcontrol/protocol";

/** Claude Code's file tools: reading and searching, and the three that change files. */
const CLAUDE_TOOLS = ["Read", "Glob", "Grep", "Write", "Edit", "MultiEdit"];
const CLAUDE_DISALLOWED = [
  "Bash",
  "BashOutput",
  "KillShell",
  "WebFetch",
  "WebSearch",
  "Task",
  "Agent",
  "NotebookEdit",
];

/**
 * Launch-time settings that fence an agent in further than the relay's own policy does, sent as
 * `_meta` of `session/new`. Claude: `_meta.claudeCode.options` is read by claude-agent-acp 0.109.1
 * (verified in its source): `tools` limits the built-in tools, `disallowedTools` is merged with the
 * adapter's, and `allowDangerouslySkipPermissions: false` removes bypass mode. Other agents get
 * nothing here: the relay's policy is the only fence for them.
 */
export function restrictionsFor(agent: AgentKind): Record<string, unknown> | undefined {
  if (agent !== "claude-code") return undefined;
  const options = {
    tools: CLAUDE_TOOLS,
    disallowedTools: CLAUDE_DISALLOWED,
    allowDangerouslySkipPermissions: false,
  };
  return { claudeCode: { options } };
}
