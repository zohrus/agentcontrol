import { z } from "zod";

/** The agents a relay can run. */
export const AgentKind = z.enum(["claude-code", "codex", "mock"]);
export type AgentKind = z.infer<typeof AgentKind>;

/** Where a session is in its life, as shown in the session list. */
export const SessionStatus = z.enum([
  "starting",
  "running",
  "waiting",
  "idle",
  "done",
  "failed",
  "archived",
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

/** Why a session is waiting on the user. */
export const WaitingReason = z.enum(["permission", "reply", "setup-failed"]);
export type WaitingReason = z.infer<typeof WaitingReason>;
