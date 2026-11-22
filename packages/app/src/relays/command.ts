import { join } from "node:path";
import { z } from "zod";

const relayMain = join(import.meta.dir, "../../../relay/src/main.ts");

/**
 * The argv that starts the local relay bridge, without its flags. Env AGENTCONTROL_RELAY_CMD
 * (a JSON array of strings) overrides the default `bun <repo>/packages/relay/src/main.ts`.
 */
export function localRelayCommand(env: Record<string, string | undefined>): string[] {
  const override = env["AGENTCONTROL_RELAY_CMD"];
  if (override === undefined) return ["bun", relayMain];
  return z.array(z.string()).min(1).parse(JSON.parse(override));
}
