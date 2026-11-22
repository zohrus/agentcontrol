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
 * adapter's, `allowDangerouslySkipPermissions: false` removes bypass mode, and `settingSources: []` keeps the
 * user's own Claude settings out. Other agents get
 * nothing here: the relay's policy is the only fence for them.
 */
export function restrictionsFor(agent: AgentKind): Record<string, unknown> | undefined {
  if (agent !== "claude-code") return undefined;
  const options = {
    tools: CLAUDE_TOOLS,
    disallowedTools: CLAUDE_DISALLOWED,
    allowDangerouslySkipPermissions: false,
    // The adapter defaults to the user's, project's and local Claude settings (allow rules, MCP
    // servers, hooks); none of them may widen what the Modify agent can do. Overrides the default.
    settingSources: [],
  };
  return { claudeCode: { options } };
}
