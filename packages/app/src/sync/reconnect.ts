import { setTimeout as sleep } from "node:timers/promises";
import type { RelayClient } from "../relays/index.ts";
import type { Live } from "./link.ts";
import { startSyncSession } from "./session.ts";
import type { SyncDeps } from "./deps.ts";

const BACKOFF_START_MS = 100;
const BACKOFF_MAX_MS = 3000;

const pause = (ms: number, signal: AbortSignal): Promise<void> =>
  sleep(ms, undefined, { signal }).catch(() => undefined);

interface Hooks {
  attach: (live: Live) => void;
  detach: () => void;
}

/** One connection's whole life. Returns true if it got as far as being in sync. */
async function oneConnection(options: {
  deps: SyncDeps;
  client: RelayClient;
  signal: AbortSignal;
  hooks: Hooks;
}): Promise<boolean> {
  const { deps, client, signal, hooks } = options;
  signal.addEventListener("abort", () => void client.close());
  try {
    const session = await startSyncSession(client, deps);
    hooks.attach({
      client,
      refreshSessions: session.refreshSessions,
      relayVersion: session.hello.relayVersion,
    });
    await client.closed;
    hooks.detach();
    session.flush();
    return true;
  } catch {
    hooks.detach();
    await client.close();
    return false;
  }
}

/** Connects, syncs until the connection drops, then reconnects with backoff, until aborted. */
export async function runConnections(options: {
  options: { connect: () => RelayClient } & SyncDeps;
  signal: AbortSignal;
  hooks: Hooks;
}): Promise<void> {
  const { signal, hooks } = options;
  const { connect, ...deps } = options.options;
  let wait = BACKOFF_START_MS;
  while (!signal.aborted) {
    const synced = await oneConnection({ deps, client: connect(), signal, hooks });
    wait = synced ? BACKOFF_START_MS : Math.min(wait * 2, BACKOFF_MAX_MS);
    await pause(wait, signal);
  }
}
