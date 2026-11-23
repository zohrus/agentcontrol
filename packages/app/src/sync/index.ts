import type { ConnectionStatus } from "@agentcontrol/protocol";
import { createLink, type Link } from "./link.ts";
import { wakeablePause } from "./pause.ts";
import { type ConnectionSettings, runConnections } from "./reconnect.ts";
import type { SyncDeps } from "./deps.ts";

export type { Hub, HubMessage } from "./hub.ts";
export { createHub } from "./hub.ts";
export type { IdeSignal, Link, TerminalSignal } from "./link.ts";
export { RelayUnavailableError } from "./link.ts";
export type { ReplaceRelay } from "./deps.ts";

const DEFAULT_BACKOFF_MAX_MS = 3000;

export interface Sync extends Link {
  /** Resolves once the first connection has handshaken, resumed its events and listed sessions. */
  ready: Promise<void>;
  /** Where the connection stands now. */
  status: () => ConnectionStatus;
  /** Skips the wait before the next connection attempt, if one is waiting. */
  retryNow: () => void;
  /** Stops reconnecting and closes the relay connection (the relay daemon keeps running). */
  stop: () => Promise<void>;
}

export interface SyncOptions extends SyncDeps {
  /** Opens a fresh relay connection; called again after every drop. */
  connect: ConnectionSettings["connect"];
  /** Called every time the connection state changes. */
  onStatus?: (status: ConnectionStatus) => void;
  /** The longest pause between connection attempts, in ms (3000 by default). */
  backoffMaxMs?: number;
}

/** A promise and the function that resolves it. */
function readiness() {
  let signal = (): void => undefined;
  const ready = new Promise<void>((resolve) => {
    signal = resolve;
  });
  return {
    ready,
    signal: (): void => {
      signal();
    },
  };
}

/** The latest status, passed on to whoever listens. */
function statusTracker(onStatus: SyncOptions["onStatus"]) {
  let current: ConnectionStatus = { state: "connecting" };
  return {
    current: () => current,
    set: (next: ConnectionStatus): void => {
      current = next;
      onStatus?.(next);
    },
  };
}

/** Keeps one workspace's relay connected and its events and sessions saved, resuming after drops. */
export function startSync(options: SyncOptions): Sync {
  const { link, attach, detach } = createLink({
    hub: options.hub,
    workspaceId: options.workspace.id,
  });
  const first = readiness();
  const status = statusTracker(options.onStatus);
  const abort = new AbortController();
  const { pause, wake } = wakeablePause();
  const settings = {
    connect: options.connect,
    backoffMaxMs: options.backoffMaxMs ?? DEFAULT_BACKOFF_MAX_MS,
  };
  const hooks = {
    attach: (live: Parameters<typeof attach>[0]) => {
      attach(live);
      first.signal();
    },
    detach,
    status: status.set,
  };
  const running = runConnections({ deps: options, settings, signal: abort.signal, pause, hooks });
  const stop = async (): Promise<void> => {
    abort.abort();
    await running;
  };
  return { ...link, ready: first.ready, status: status.current, retryNow: wake, stop };
}
