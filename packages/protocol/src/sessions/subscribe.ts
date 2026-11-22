import { z } from "zod";
import { SessionEvent } from "../events/index.ts";
import { SessionId } from "../ids/index.ts";

const seq = z.number().int().nonnegative();

/** Params of relay/events.subscribe: one session's cursor, or a cursor per session. */
export const EventsSubscribeParams = z.union([
  z.object({ sessionId: SessionId, afterSeq: seq }),
  z.object({ afterSeq: z.record(SessionId, seq) }),
]);
/** Result of relay/events.subscribe; events follow as relay/event notifications. */
export const EventsSubscribeResult = z.object({});

/** Params of the relay/event notification: one event. */
export const EventNotificationParams = z.object({ event: SessionEvent });
