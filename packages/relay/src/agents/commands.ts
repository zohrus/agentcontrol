import type { AgentKind } from "@agentcontrol/protocol";
import { ADAPTERS, adaptersRoot, downloading, needsDownload } from "./adapters.ts";
import { installedAdapterEntry } from "./install.ts";
import { launchAdapter } from "./launcher.ts";
import type { Timed } from "../steps/index.ts";
import type { HostEnv } from "./types.ts";

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

/** How to start an agent: the argv, and the variables to add to its environment. */
export interface Launch {
  command: string[];
  env: Record<string, string>;
}

/**
 * How to start this agent kind, or undefined when it is not configured. An override variable gives
 * the whole command. Otherwise the pinned adapter is installed in the relay's own folder (first
 * use only) and started through the launcher by the relay's own program.
 */
export async function launchFor(call: {
  kind: AgentKind;
  env: HostEnv;
  timed: Timed;
}): Promise<Launch | undefined> {
  const { kind, env, timed } = call;
  const variable = OVERRIDE_VARIABLES[kind];
  const override = env[variable];
  if (override) return { command: parseArgv(variable, override), env: {} };
  const adapter = ADAPTERS[kind];
  if (adapter === undefined) return undefined;
  // Only the first use downloads: that is the step worth showing, and timing.
  const install = () => installedAdapterEntry({ adapter, env });
  const download = {
    id: "install",
    doing: downloading(adapter),
    done: `Downloaded the ${adapter.label} adapter`,
  };
  const entry = await (needsDownload({ adapter, env }) ? timed(download, install) : install());
  return launchAdapter({ entry, folder: adaptersRoot(env) });
}

/** Agent kinds that can be launched on this machine. */
export function availableAgents(env: HostEnv): AgentKind[] {
  return KINDS.filter((kind) => env[OVERRIDE_VARIABLES[kind]] || ADAPTERS[kind] !== undefined);
}
