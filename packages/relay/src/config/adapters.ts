import type { ConfigAgent } from "@agentcontrol/protocol";
import { claudeAdapter } from "./claude.ts";
import { codexAdapter } from "./codex.ts";
import type { HarnessAdapter } from "./types.ts";

/** Adding an agent means adding one adapter here. */
export const ADAPTERS: Record<ConfigAgent, HarnessAdapter> = {
  "claude-code": claudeAdapter,
  codex: codexAdapter,
};
