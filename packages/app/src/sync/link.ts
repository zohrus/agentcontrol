import {
  type RelayMethodName,
  type RelayParams,
  type RelayResult,
  RelayName,
  RelayNotifications,
  type SessionId,
} from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";
import type { Hub } from "./hub.ts";
import { type IdeSignal, ideSignals } from "./ide-signals.ts";
import { type TerminalSignal, terminalSignals } from "./terminal-signals.ts";

export type { IdeSignal } from "./ide-signals.ts";
export type { TerminalSignal } from "./terminal-signals.ts";

/** The relay connection as the rest of the app sees it: there when connected, an error when not. */
export class RelayUnavailableError extends Error {
  constructor() {
    super("The relay is not connected right now.");
  }
}

export interface Link {
  /**
   * Calls the listener with the output and ending of terminals on this workspace's relay, and with
   * `lost` when the connection ends (its terminals end with it). Returns how to stop listening.
   */
  onTerminal: (listener: (signal: TerminalSignal) => void) => () => void;
  /**
   * Calls the listener with what the browser VS Code tunnel `tunnelId` reports (response body,
   * WebSocket messages, ends), and with `lost` when the connection ends. Returns how to stop.
   */
  onIde: (tunnelId: string, listener: (signal: IdeSignal) => void) => () => void;
  call: <M extends RelayMethodName>(method: M, params: RelayParams<M>) => Promise<RelayResult<M>>;
  /** Starts forwarding file changes of a session's worktree; a no-op if already watched. */
  watchFiles: (sessionId: SessionId) => Promise<void>;
  /** Fetches the relay's session list now, so a new session shows at once. */
  refreshSessions: () => Promise<void>;
}

/** The pieces of one live connection that the link delegates to. */
export interface Live {
  client: RelayClient;
  refreshSessions: () => Promise<void>;
}

/** Forwards `relay/fs.changed` notifications of this connection to the hub. */
function forwardFileChanges(client: RelayClient, target: { hub: Hub; workspaceId: string }): void {
  client.onNotification(({ method, params }) => {
    if (method !== RelayName.fsChanged) return;
    const change = RelayNotifications[RelayName.fsChanged].parse(params);
    target.hub.publish({ type: "fs", workspaceId: target.workspaceId, ...change });
  });
}

/** Remembers which sessions' files are being watched on the current connection. */
function fileWatching(current: () => Live) {
  let watched = new Set<SessionId>();
  return {
    reset: () => {
      watched = new Set();
    },
    watch: async (sessionId: SessionId): Promise<void> => {
      if (watched.has(sessionId)) return;
      watched.add(sessionId);
      await current().client.call(RelayName.fsWatch, { sessionId });
    },
  };
}

/** What the relay pushes about shells and browser VS Code tunnels, and who listens to it. */
function pushes() {
  const terminals = terminalSignals();
  const ide = ideSignals();
  return {
    onTerminal: terminals.listen,
    onIde: ide.listen,
    forward: (client: RelayClient): void => {
      terminals.forward(client);
      ide.forward(client);
    },
    lost: (): void => {
      terminals.lost();
      ide.lost();
    },
  };
}

/** Holds whichever connection is current, and what the app watches on it. */
export function createLink(target: { hub: Hub; workspaceId: string }) {
  let live: Live | undefined;
  const current = (): Live => {
    if (!live) throw new RelayUnavailableError();
    return live;
  };
  const files = fileWatching(current);
  const signals = pushes();
  const link: Link = {
    onTerminal: signals.onTerminal,
    onIde: signals.onIde,
    call: (method, params) => current().client.call(method, params),
    refreshSessions: () => current().refreshSessions(),
    watchFiles: files.watch,
  };
  const attach = (next: Live): void => {
    live = next;
    files.reset();
    forwardFileChanges(next.client, target);
    signals.forward(next.client);
  };
  return {
    link,
    attach,
    detach: () => {
      live = undefined;
      signals.lost();
    },
  };
}
