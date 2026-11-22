import type { RelayClient } from "../relays/index.ts";
import { createLink, type Link } from "./link.ts";
import { runConnections } from "./reconnect.ts";
import type { SyncDeps } from "./session.ts";

export type { Hub, HubMessage } from "./hub.ts";
export { createHub } from "./hub.ts";
export type { Link } from "./link.ts";
export { RelayUnavailableError } from "./link.ts";

export interface Sync extends Link {
  /** Resolves once the first connection has handshaken, resumed its events and listed sessions. */
  ready: Promise<void>;
  /** Stops reconnecting and closes the relay connection (the relay daemon keeps running). */
  stop: () => Promise<void>;
}

export interface SyncOptions extends SyncDeps {
  /** Opens a fresh relay connection; called again after every drop. */
  connect: () => RelayClient;
}

/** Keeps one workspace's relay connected and its events and sessions saved, resuming after drops. */
export function startSync(options: SyncOptions): Sync {
  const { link, attach, detach } = createLink({
    hub: options.hub,
    workspaceId: options.workspace.id,
  });
  let signalReady = (): void => undefined;
  const ready = new Promise<void>((resolve) => {
    signalReady = resolve;
  });
  const abort = new AbortController();
  const running = runConnections({
    options,
    signal: abort.signal,
    hooks: {
      attach: (live) => {
        attach(live);
        signalReady();
      },
      detach,
    },
  });
  return {
    ...link,
    ready,
    stop: async () => {
      abort.abort();
      await running;
    },
  };
}
