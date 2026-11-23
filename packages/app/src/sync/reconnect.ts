import type { ConnectionStatus } from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";
import type { SyncDeps } from "./deps.ts";
import type { Live } from "./link.ts";
import { RelayReplaced, startSyncSession } from "./session.ts";

const BACKOFF_START_MS = 100;

export interface Hooks {
  attach: (live: Live) => void;
  detach: () => void;
  status: (status: ConnectionStatus) => void;
}

export interface ConnectionSettings {
  /** Opens a relay connection; rejecting means the machine could not be reached. */
  connect: () => Promise<RelayClient> | RelayClient;
  /** The longest pause between attempts, which double from 100 ms up to this. */
  backoffMaxMs: number;
}

type Outcome = "synced" | "replaced" | "failed";

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Reports why a connection could not be used and says whether to retry at once. */
function afterFailure(options: {
  error: unknown;
  client: RelayClient | undefined;
  hooks: Hooks;
}): Outcome {
  const { error, client, hooks } = options;
  hooks.detach();
  if (error instanceof RelayReplaced) {
    hooks.status({ state: "reconnecting" });
    return "replaced";
  }
  hooks.status({ state: "offline", reason: client?.failure() ?? messageOf(error) });
  return "failed";
}

/** Syncs one live connection until it ends. Returns once it has, having reported its states. */
async function syncUntilClosed(options: {
  client: RelayClient;
  deps: SyncDeps;
  hooks: Hooks;
  aborted: () => boolean;
}): Promise<void> {
  const { client, deps, hooks, aborted } = options;
  const session = await startSyncSession(client, deps);
  hooks.attach({ client, refreshSessions: session.refreshSessions });
  const { relayVersion } = session.hello;
  hooks.status(
    session.outdated === undefined
      ? { state: "connected", relayVersion }
      : { state: "needs-relay-update", reason: session.outdated, relayVersion },
  );
  await client.closed;
  hooks.detach();
  session.flush();
  if (!aborted()) hooks.status({ state: "reconnecting" });
}

/** Closes the connection when the app stops, even if that already happened while it was opening. */
function closeOnAbort(client: RelayClient, signal: AbortSignal): void {
  if (signal.aborted) void client.close();
  else signal.addEventListener("abort", () => void client.close(), { once: true });
}

/** One connection's whole life. */
async function oneConnection(options: {
  deps: SyncDeps;
  settings: ConnectionSettings;
  signal: AbortSignal;
  hooks: Hooks;
}): Promise<Outcome> {
  const { deps, settings, signal, hooks } = options;
  let client: RelayClient | undefined;
  try {
    client = await settings.connect();
    closeOnAbort(client, signal);
    await syncUntilClosed({ client, deps, hooks, aborted: () => signal.aborted });
    return "synced";
  } catch (error) {
    const outcome = afterFailure({ error, client, hooks });
    await client?.close();
    return outcome;
  }
}

/** Connects, syncs until the connection drops, then reconnects with backoff, until aborted. */
export async function runConnections(options: {
  deps: SyncDeps;
  settings: ConnectionSettings;
  signal: AbortSignal;
  hooks: Hooks;
  pause: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<void> {
  const { signal, pause, settings } = options;
  let wait = BACKOFF_START_MS;
  while (!signal.aborted) {
    const outcome = await oneConnection(options);
    wait = outcome === "synced" ? BACKOFF_START_MS : Math.min(wait * 2, settings.backoffMaxMs);
    await pause(wait, signal);
  }
}
