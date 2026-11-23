import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentKind } from "@agentcontrol/protocol";

/** An ACP adapter the relay runs with the bundled Bun runtime, at one pinned version. */
export interface Adapter {
  package: string;
  version: string;
  /** What the user knows it as, for messages. */
  label: string;
}

export const ADAPTERS: Partial<Record<AgentKind, Adapter>> = {
  "claude-code": {
    package: "@agentclientprotocol/claude-agent-acp",
    version: "0.109.1",
    label: "Claude Code",
  },
  codex: { package: "@agentclientprotocol/codex-acp", version: "2.9.0", label: "Codex" },
};

/** Env var that names the folder where downloaded adapters are kept (set by the relay daemon). */
export const ADAPTER_CACHE = "AGENTCONTROL_ADAPTER_CACHE";

/**
 * The environment that turns the relay's own binary into `bun` for one adapter launch, and keeps
 * what it downloads in the relay's folder instead of the user's global package cache.
 */
export function adapterEnv(env: Record<string, string | undefined>): Record<string, string> {
  const cache = env[ADAPTER_CACHE];
  return { BUN_BE_BUN: "1", ...(cache === undefined ? {} : { BUN_INSTALL_CACHE_DIR: cache }) };
}

/** The argv that runs the adapter: this binary as `bun x`, so no `bun` has to be installed. */
export function adapterCommand(adapter: Adapter): string[] {
  return [process.execPath, "x", "--bun", `${adapter.package}@${adapter.version}`];
}

/** Whether the adapter is already in the download folder. */
function isDownloaded(adapter: Adapter, cache: string): boolean {
  const [scope = "", name = ""] = adapter.package.split("/");
  const folder = join(cache, scope);
  if (!existsSync(folder)) return false;
  return readdirSync(folder).some((entry) => entry.startsWith(`${name}@${adapter.version}@@@`));
}

/** True when the adapter is not in the download folder yet, so the launch has to fetch it. */
export function needsDownload(options: {
  adapter: Adapter;
  env: Record<string, string | undefined>;
}): boolean {
  const cache = options.env[ADAPTER_CACHE];
  return cache !== undefined && !isDownloaded(options.adapter, cache);
}

export const downloading = (adapter: Adapter): string =>
  `Downloading the ${adapter.label} adapter (first use only, needs the internet)...\n`;

export const downloadFailed = (adapter: Adapter): string =>
  `Could not download the ${adapter.label} adapter. Check your internet connection and start the session again.\n`;
