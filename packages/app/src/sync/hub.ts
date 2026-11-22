import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import type { StoredSession } from "../store/index.ts";

/**
 * What the app tells its in-process listeners (the SSE stream) as things change. Every message
 * names the workspace it came from: session ids are only unique within one workspace.
 */
export type HubMessage =
  | { type: "event"; workspaceId: string; event: SessionEvent }
  | { type: "sessions"; workspaceId: string; sessions: StoredSession[] }
  | { type: "fs"; workspaceId: string; sessionId: SessionId; paths: string[] };

export interface Hub {
  /** Calls the listener for every message published from now on; returns an unsubscribe function. */
  subscribe: (listener: (message: HubMessage) => void) => () => void;
  publish: (message: HubMessage) => void;
}

/** A tiny in-process pub/sub. */
export function createHub(): Hub {
  const listeners = new Set<(message: HubMessage) => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (message) => {
      listeners.forEach((listener) => {
        listener(message);
      });
    },
  };
}
