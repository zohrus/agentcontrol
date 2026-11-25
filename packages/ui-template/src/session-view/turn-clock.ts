import type { SessionEvent } from "@agentcontrol/protocol";

/** When the turn that is running began: the time of the last prompt sent to the agent. */
export function turnStartedAt(events: readonly SessionEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event?.kind === "prompt-sent") return event.ts;
  }
  return undefined;
}
