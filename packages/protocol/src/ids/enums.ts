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
  /** The relay stopped while the agent was running: the agent is gone; resume it to carry on. */
  "interrupted",
  "archived",
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

/** Why a session is waiting on the user. */
export const WaitingReason = z.enum(["permission", "reply", "setup-failed"]);
export type WaitingReason = z.infer<typeof WaitingReason>;

/** Where a session runs: in its own git worktree, or in a plain directory (the Modify agent). */
export const SessionKind = z.enum(["worktree", "directory"]);
export type SessionKind = z.infer<typeof SessionKind>;
