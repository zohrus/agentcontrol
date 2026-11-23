import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { CLAUDE_ADAPTER, MOCK_ADAPTER_SOURCE } from "./mock-adapter-package.ts";
import type { Session } from "./relay.ts";
import { type RunningRelay, startRelayWithLocalRepo } from "./start-relay.ts";

/** A relay that is running on a machine with no internet. */
export interface OfflineRelay extends RunningRelay {
  /** Starts a Claude Code session; the adapter is not replaced by the mock agent unless installed. */
  startsClaudeCodeSession(options: { prompt: string }): Promise<Session>;
}

/** The environment that makes an install fail at once, as it does with no internet. */
const NO_INTERNET = { NPM_CONFIG_REGISTRY: "http://127.0.0.1:9/" };

function offline(relay: RunningRelay): OfflineRelay {
  return Object.assign(relay, {
    startsClaudeCodeSession: (options: { prompt: string }) =>
      relay.user.startsSession({ ...options, agent: "claude-code" }),
  });
}

/** The relay with no internet; the Claude Code adapter has not been downloaded yet. */
export async function startRelayWithoutInternet(): Promise<OfflineRelay> {
  return offline(await startRelayWithLocalRepo({ env: NO_INTERNET }));
}

/** Writes the folder an install leaves: the adapter's package, whose program is the mock agent. */
async function installAdapterByHand(adapters: string): Promise<void> {
  const packageFolder = join(
    adapters,
    "claude-agent-acp@0.109.1",
    "node_modules",
    CLAUDE_ADAPTER.name,
  );
  await mkdir(packageFolder, { recursive: true });
  const manifest = {
    name: CLAUDE_ADAPTER.name,
    type: "module",
    bin: { [CLAUDE_ADAPTER.bin]: "index.js" },
  };
  await Bun.write(join(packageFolder, "package.json"), JSON.stringify(manifest));
  await Bun.write(join(packageFolder, "index.js"), MOCK_ADAPTER_SOURCE);
}

/** The Claude Code adapter's folder exists, but its package.json declares no program to run. */
export async function startRelayWithADamagedAdapter(): Promise<OfflineRelay> {
  const adapters = await mkdtemp(join(tmpdir(), "agentcontrol-adapters-"));
  onTestEnd(() => rm(adapters, { recursive: true, force: true }));
  const packageFolder = join(
    adapters,
    "claude-agent-acp@0.109.1",
    "node_modules",
    CLAUDE_ADAPTER.name,
  );
  await mkdir(packageFolder, { recursive: true });
  await Bun.write(join(packageFolder, "package.json"), "{}");
  const env = { ...NO_INTERNET, AGENTCONTROL_ADAPTER_CACHE: adapters };
  return offline(await startRelayWithLocalRepo({ env }));
}

/** The same, but the Claude Code adapter is already in the folder where the relay keeps adapters. */
export async function startRelayWithoutInternetAfterAdapterDownload(): Promise<OfflineRelay> {
  const adapters = await mkdtemp(join(tmpdir(), "agentcontrol-adapters-"));
  onTestEnd(() => rm(adapters, { recursive: true, force: true }));
  await installAdapterByHand(adapters);
  const env = { ...NO_INTERNET, AGENTCONTROL_ADAPTER_CACHE: adapters };
  return offline(await startRelayWithLocalRepo({ env }));
}
