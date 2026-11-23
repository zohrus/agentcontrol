import type { SessionEvent } from "@agentcontrol/protocol";

/**
 * An event before the log assigns its sequence number and timestamp. `ts` is only given for an
 * event that records something that happened earlier (what recovery writes for a dead relay).
 */
export type EventInput = {
  [K in SessionEvent["kind"]]: Pick<Extract<SessionEvent, { kind: K }>, "kind" | "payload">;
}[SessionEvent["kind"]] & { ts?: string };
