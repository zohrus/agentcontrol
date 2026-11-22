import type { ConnectionStatus } from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";
import type { Live } from "./link.ts";
import { startSyncSession } from "./session.ts";
import type { SyncDeps } from "./session.ts";
import { RelayVersionMismatch } from "./version.ts";

const BACKOFF_START_MS = 100;

export interface Hooks {
  attach: (live: Live) => void;
  detach: () => void;
  status: (status: ConnectionStatus) => void;
}

/** What to do about a relay of the wrong version; the answer says whether it was replaced. */
export type ReplaceRelay = (options: {
  client: RelayClient;
  mismatch: RelayVersionMismatch;
}) => Promise<{ replaced: boolean; reason: string }>;

export interface ConnectionSettings {
  /** Opens a relay connection; rejecting means the machine could not be reached. */
  connect: () => Promise<RelayClient> | RelayClient;
  /** Called when the relay on the machine has another version than the app. */
  replaceRelay?: ReplaceRelay | undefined;
  /** The longest pause between attempts, which double from 100 ms up to this. */
  backoffMaxMs: number;
}

type Outcome = "synced" | "replaced" | "failed";

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function onMismatch(options: {
  error: RelayVersionMismatch;
  client: RelayClient;
  settings: ConnectionSettings;
  hooks: Hooks;
}): Promise<Outcome> {
  const { error, client, settings, hooks } = options;
  const fallback = { replaced: false, reason: error.message };
  const answer =
    (await settings.replaceRelay?.({ client, mismatch: error }).catch(() => fallback)) ?? fallback;
  hooks.status(
    answer.replaced
      ? { state: "reconnecting" }
      : { state: "needs-relay-update", reason: answer.reason },
  );
  return answer.replaced ? "replaced" : "failed";
}

/** Reports why a connection could not be used and says whether to retry at once. */
async function afterFailure(options: {
  error: unknown;
  client: RelayClient | undefined;
  settings: ConnectionSettings;
  hooks: Hooks;
}): Promise<Outcome> {
  const { error, client, settings, hooks } = options;
  hooks.detach();
  if (client && error instanceof RelayVersionMismatch) {
    return onMismatch({ error, client, settings, hooks });
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
  hooks.status({ state: "connected" });
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
    const outcome = await afterFailure({ error, client, settings, hooks });
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
    wait = outcome === "failed" ? Math.min(wait * 2, settings.backoffMaxMs) : BACKOFF_START_MS;
    if (outcome !== "replaced") await pause(wait, signal);
  }
}
