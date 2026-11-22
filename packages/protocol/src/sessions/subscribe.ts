import { z } from "zod";
import { SessionEvent } from "../events/index.ts";
import { SessionId } from "../ids/index.ts";
import { SessionSummary } from "./summary.ts";

const seq = z.number().int().nonnegative();

/** Params of relay/events.subscribe: one session's cursor, or a cursor per session. */
export const EventsSubscribeParams = z.union([
  z.object({ sessionId: SessionId, afterSeq: seq }),
  z.object({ afterSeq: z.record(SessionId, seq) }),
]);
/** Result of relay/events.subscribe; events follow as relay/event notifications. */
export const EventsSubscribeResult = z.object({});

/** Params of relay/events.read: one session. */
export const EventsReadParams = z.object({ sessionId: SessionId });
/** Result of relay/events.read: every event of the session, normalised as the relay does today. */
export const EventsReadResult = z.object({ events: z.array(SessionEvent) });

/** Params of the relay/event notification: one event. */
export const EventNotificationParams = z.object({ event: SessionEvent });

/**
 * Params of the relay/sessions.changed notification: summaries that changed, sent to every client
 * that has called relay/events.subscribe (for the sessions it follows).
 */
export const SessionsChangedParams = z.object({ sessions: z.array(SessionSummary) });

export type SessionsChangedParams = z.infer<typeof SessionsChangedParams>;
export type EventsReadResult = z.infer<typeof EventsReadResult>;
export type EventsSubscribeParams = z.infer<typeof EventsSubscribeParams>;
export type EventsSubscribeResult = z.infer<typeof EventsSubscribeResult>;
export type EventNotificationParams = z.infer<typeof EventNotificationParams>;
