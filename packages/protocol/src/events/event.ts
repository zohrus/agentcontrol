import { z } from "zod";
import { SessionId } from "../ids/index.ts";
import * as p from "./payloads.ts";

const base = {
  sessionId: SessionId,
  seq: z.number().int().positive(),
  ts: z.iso.datetime({ offset: true }),
};

/** One append-only relay event, discriminated on `kind`; `seq` is per session, from 1. */
export const SessionEvent = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("acp"), payload: p.AcpPayload }),
  z.object({ ...base, kind: z.literal("session-created"), payload: p.SessionCreatedPayload }),
  z.object({ ...base, kind: z.literal("setup-output"), payload: p.SetupOutputPayload }),
  z.object({ ...base, kind: z.literal("setup-finished"), payload: p.SetupFinishedPayload }),
  z.object({ ...base, kind: z.literal("agent-started"), payload: p.AgentStartedPayload }),
  z.object({ ...base, kind: z.literal("agent-exited"), payload: p.AgentExitedPayload }),
  z.object({ ...base, kind: z.literal("agent-interrupted"), payload: p.AgentInterruptedPayload }),
  z.object({ ...base, kind: z.literal("session-resumed"), payload: p.SessionResumedPayload }),
  z.object({
    ...base,
    kind: z.literal("permission-requested"),
    payload: p.PermissionRequestedPayload,
  }),
  z.object({
    ...base,
    kind: z.literal("permission-answered"),
    payload: p.PermissionAnsweredPayload,
  }),
  z.object({ ...base, kind: z.literal("prompt-sent"), payload: p.PromptSentPayload }),
  z.object({ ...base, kind: z.literal("turn-ended"), payload: p.TurnEndedPayload }),
  z.object({ ...base, kind: z.literal("session-archived"), payload: p.EmptyPayload }),
]);
export type SessionEvent = z.infer<typeof SessionEvent>;

/** The name of every event kind. */
export type EventKind = SessionEvent["kind"];
