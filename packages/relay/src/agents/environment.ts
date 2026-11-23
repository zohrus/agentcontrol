import type { HostEnv } from "./types.ts";

/** Variables the relay sets for its own sake; no agent, and nothing an agent runs, may inherit them. */
const INTERNAL = new Set(["BUN_BE_BUN", "BUN_INSTALL_CACHE_DIR"]);
const INTERNAL_PREFIX = "AGENTCONTROL_";

function isInternal(name: string): boolean {
  return INTERNAL.has(name) || name.startsWith(INTERNAL_PREFIX);
}

/** The relay's environment without the relay's own variables: what an agent process starts with. */
export function agentEnvironment(host: HostEnv): Record<string, string> {
  const inherited = Object.entries(host).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !isInternal(entry[0]),
  );
  return Object.fromEntries(inherited);
}
