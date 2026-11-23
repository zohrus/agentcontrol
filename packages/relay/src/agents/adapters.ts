import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentKind } from "@agentcontrol/protocol";

/** An ACP adapter the relay installs once, at one pinned version, and runs with its own runtime. */
export interface Adapter {
  package: string;
  version: string;
  /** The name of the executable the package declares in its `bin`. */
  bin: string;
  /** What the user knows it as, for messages. */
  label: string;
}

export const ADAPTERS: Partial<Record<AgentKind, Adapter>> = {
  "claude-code": {
    package: "@agentclientprotocol/claude-agent-acp",
    version: "0.109.1",
    bin: "claude-agent-acp",
    label: "Claude Code",
  },
  codex: {
    package: "@agentclientprotocol/codex-acp",
    version: "2.9.0",
    bin: "codex-acp",
    label: "Codex",
  },
};

/** Env var that names the folder where installed adapters are kept (set by the relay daemon). */
export const ADAPTER_CACHE = "AGENTCONTROL_ADAPTER_CACHE";

/** Where this adapter's install lives: `<adapters folder>/<name>@<version>`. */
export function adapterFolder(options: { adapter: Adapter; root: string }): string {
  const name = options.adapter.package.split("/").pop() ?? options.adapter.package;
  return join(options.root, `${name}@${options.adapter.version}`);
}

/** The folder the relay keeps adapters in, from the relay's environment. */
export function adaptersRoot(env: Record<string, string | undefined>): string {
  const root = env[ADAPTER_CACHE];
  if (root === undefined) throw new Error(`${ADAPTER_CACHE} must name the relay's adapter folder`);
  return root;
}

/** True when the adapter is not installed yet, so starting it has to download it. */
export function needsDownload(options: {
  adapter: Adapter;
  env: Record<string, string | undefined>;
}): boolean {
  const root = options.env[ADAPTER_CACHE];
  return root !== undefined && !existsSync(adapterFolder({ adapter: options.adapter, root }));
}

export const downloading = (adapter: Adapter): string =>
  `Downloading the ${adapter.label} adapter (first use only, needs the internet)...\n`;

export const unreadable = (options: { adapter: Adapter; folder: string; reason: string }): string =>
  `The installed ${options.adapter.label} adapter in ${options.folder} could not be read (${options.reason}). Delete that folder and start the session again to download it afresh.`;

export const downloadFailed = (options: { adapter: Adapter; reason: string }): string =>
  `The ${options.adapter.label} adapter has not been downloaded yet and could not start. Check your internet connection and start the session again.\n${options.reason}`;
