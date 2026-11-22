import type { ConfigAgent, ScopedItem } from "@agentcontrol/protocol";
import { ADAPTERS } from "./adapters.ts";
import { makeCtx } from "./fs.ts";

/** What each agent has configured today, as canonical items, for the import flow. Best effort. */
export async function inspectConfig(input: {
  agents: ConfigAgent[];
  homeDir: string;
  repoPath?: string | undefined;
}): Promise<ScopedItem[]> {
  const ctx = makeCtx(input);
  const found = await Promise.all(input.agents.map((a) => ADAPTERS[a].inspect(ctx)));
  return found.flat();
}
