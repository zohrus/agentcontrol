import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RelayName } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import type { Session } from "./relay.ts";
import { type RunningRelay, startRelayWithLocalRepo } from "./start-relay.ts";

/** The version of the Claude Code adapter the relay pins (packages/relay/src/agents/adapters.ts). */
const CLAUDE_ADAPTER_FOLDER = "@agentclientprotocol/claude-agent-acp@0.109.1@@@1";

/** A relay that is running on a machine with no internet, whose agents start the real adapters. */
export interface OfflineRelay extends RunningRelay {
  /** Starts a Claude Code session; the adapter is not replaced by the mock agent. */
  startsClaudeCodeSession(options: { prompt: string }): Promise<Session>;
}

/** The environment that makes `bun x` fail at once, as it does with no internet. */
const NO_INTERNET = { NPM_CONFIG_REGISTRY: "http://127.0.0.1:9/" };

async function startsClaudeCodeSession(
  relay: RunningRelay,
  options: { prompt: string },
): Promise<Session> {
  const { sessionId } = await relay.call(RelayName.sessionsCreate, {
    agent: "claude-code",
    repoPath: relay.repoPath,
    baseBranch: "main",
    prompt: options.prompt,
  });
  return { id: sessionId, title: options.prompt };
}

function offline(relay: RunningRelay): OfflineRelay {
  return Object.assign(relay, {
    startsClaudeCodeSession: (options: { prompt: string }) =>
      startsClaudeCodeSession(relay, options),
  });
}

/** The relay with no internet; the Claude Code adapter has not been downloaded yet. */
export async function startRelayWithoutInternet(): Promise<OfflineRelay> {
  return offline(await startRelayWithLocalRepo({ env: NO_INTERNET }));
}

/** The same, but the Claude Code adapter is already in the folder where the relay keeps adapters. */
export async function startRelayWithoutInternetAfterAdapterDownload(): Promise<OfflineRelay> {
  const cache = await mkdtemp(join(tmpdir(), "agentcontrol-adapters-"));
  onTestEnd(() => rm(cache, { recursive: true, force: true }));
  await mkdir(join(cache, CLAUDE_ADAPTER_FOLDER), { recursive: true });
  const env = { ...NO_INTERNET, AGENTCONTROL_ADAPTER_CACHE: cache };
  return offline(await startRelayWithLocalRepo({ env }));
}
