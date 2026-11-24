import { RelayName } from "@agentcontrol/protocol";
import { Timeline } from "./timeline.ts";
import type { Wire } from "./wire.ts";

const HELD_WAIT_MS = 5000;

/** A relay connection that takes the app's agent-list request and never answers it. */
export interface SilentRelay {
  /** Wraps the app's connection to the relay; pass it as `relayWire`. */
  readonly wire: (real: Wire) => Wire;
  /** One entry for each request that was taken and left unanswered. */
  readonly held: Timeline<string>;
}

/**
 * The relay answers the app's handshake, then lets the first request for the agent list go
 * unanswered, so a test can end the connection while that request is still waiting.
 */
export function aRelayThatLeavesTheAgentListUnanswered(): SilentRelay {
  const held = new Timeline<string>(HELD_WAIT_MS);
  let handshakes = 0;
  const wire = (real: Wire): Wire => ({
    ...real,
    send: (line) => {
      const message = JSON.parse(line) as { method?: string };
      if (message.method !== RelayName.hello || ++handshakes === 1) {
        real.send(line);
        return;
      }
      held.record(line);
    },
  });
  return { wire, held };
}
