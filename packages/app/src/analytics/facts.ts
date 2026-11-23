import type { SessionEvent } from "@agentcontrol/protocol";
import { permissionsOfEvents } from "./permission-facts.ts";
import { timeOfEvents } from "./time-facts.ts";
import { toolsOfEvents } from "./tool-facts.ts";
import type { SessionFacts } from "./types.ts";

function stopReasonsOf(events: SessionEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (event.kind !== "turn-ended") continue;
    const { stopReason } = event.payload;
    counts[stopReason] = (counts[stopReason] ?? 0) + 1;
  }
  return counts;
}

/**
 * Everything the analytics say about one session's behaviour, worked out from its saved events (the
 * ones in range, when the user picked a range). `liveUntil` is "now" for a session that is still
 * running or waiting, so a request nobody has answered yet keeps counting as waiting.
 */
export function factsOfEvents(events: SessionEvent[], liveUntil?: number): SessionFacts {
  return {
    turns: events.filter((event) => event.kind === "prompt-sent").length,
    ...timeOfEvents(events, liveUntil),
    ...permissionsOfEvents(events),
    ...toolsOfEvents(events),
    stopReasons: stopReasonsOf(events),
  };
}
