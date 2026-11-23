import type { AgentKind } from "@agentcontrol/protocol";
import {
  ADAPTERS,
  type Adapter,
  adapterCommand,
  adapterEnv,
  downloadFailed,
  downloading,
  needsDownload,
} from "./adapters.ts";

/** The environment the relay reads its agent settings from (the process env, unless injected). */
export type HostEnv = Record<string, string | undefined>;

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

/** How to start an agent: the argv, and the variables to add to the agent's environment. */
export interface Launch {
  command: string[];
  env: Record<string, string>;
  /** Set when the command is the default one, which downloads this adapter on first use. */
  adapter?: Adapter;
}

/**
 * How this agent kind is launched, or undefined when it is not configured. An override variable
 * gives the whole command. Otherwise the pinned adapter runs through this binary acting as `bun`.
 */
export function launchFor(kind: AgentKind, env: HostEnv): Launch | undefined {
  const variable = OVERRIDE_VARIABLES[kind];
  const override = env[variable];
  if (override) return { command: parseArgv(variable, override), env: {} };
  const adapter = ADAPTERS[kind];
  if (adapter === undefined) return undefined;
  return { command: adapterCommand(adapter), env: adapterEnv(env), adapter };
}

/** Agent kinds that can be launched on this machine. */
export function availableAgents(env: HostEnv): AgentKind[] {
  return KINDS.filter((kind) => launchFor(kind, env) !== undefined);
}

/** What to tell the user while an agent's adapter is downloaded for the first time, if it is. */
export function firstUseDownload(
  kind: AgentKind,
  env: HostEnv,
): { started: string; failed: string } | undefined {
  const adapter = launchFor(kind, env)?.adapter;
  if (adapter === undefined || !needsDownload({ adapter, env })) return undefined;
  return { started: downloading(adapter), failed: downloadFailed(adapter) };
}
