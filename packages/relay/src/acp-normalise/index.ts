import type { SessionEvent } from "@agentcontrol/protocol";
import { normaliseMessage } from "./messages.ts";
import { describeTool } from "./tools.ts";

/**
 * Goes up whenever a change to the translation changes what `updates` or `tool` hold for the same
 * raw message. The relay reports it in `relay/hello`; the app re-reads the sessions it saved with
 * an older one.
 */
export const NORMALISER_VERSION = 1;

/**
 * The event as served to clients: "acp" events carry `updates` and "permission-requested" events
 * carry `tool`, both made from the raw data, which stays unchanged. Nothing here is ever stored,
 * so an improvement to the translation also applies to logs written before it.
 */
export function withNormalised(event: SessionEvent): SessionEvent {
  if (event.kind === "acp") {
    const { direction, message } = event.payload;
    return {
      ...event,
      payload: { ...event.payload, updates: normaliseMessage({ direction, message }) },
    };
  }
  if (event.kind === "permission-requested") {
    return { ...event, payload: { ...event.payload, tool: describeTool(event.payload.toolCall) } };
  }
  return event;
}
