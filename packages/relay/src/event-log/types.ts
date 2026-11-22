import type { SessionEvent } from "@agentcontrol/protocol";

/** An event before the log assigns its sequence number and timestamp. */
export type EventInput = {
  [K in SessionEvent["kind"]]: Pick<Extract<SessionEvent, { kind: K }>, "kind" | "payload">;
}[SessionEvent["kind"]];
