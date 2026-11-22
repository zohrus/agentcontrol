import type { AgentUpdate, SessionEvent } from "@agentcontrol/protocol";

/** The normalised updates the relay attached to an event; none for events that are not agent traffic. */
export function updatesOf(event: SessionEvent): AgentUpdate[] {
  return event.kind === "acp" ? (event.payload.updates ?? []) : [];
}

/** The updates of every event, in order. */
export function allUpdates(events: SessionEvent[]): AgentUpdate[] {
  return events.flatMap(updatesOf);
}
