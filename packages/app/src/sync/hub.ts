import type { SessionEvent, SessionId, SessionSummary } from "@agentcontrol/protocol";

/** What the app tells its in-process listeners (the SSE stream) as things change. */
export type HubMessage =
  | { type: "event"; event: SessionEvent }
  | { type: "sessions"; sessions: SessionSummary[] }
  | { type: "fs"; sessionId: SessionId; paths: string[] };

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
