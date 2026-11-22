import { z } from "zod";
import { PermissionOption } from "../events/index.ts";
import { AgentKind, SessionId, SessionStatus, WaitingReason } from "../ids/index.ts";

/** What a pending request asks to do, in terms every agent shares. Everything but the title is optional. */
export const PendingToolCall = z.object({
  /** What the agent calls the action, e.g. "Run npm test". Never empty. */
  title: z.string(),
  /** The kind of action when the agent says: "execute", "edit", "read", ... */
  kind: z.string().optional(),
  /** The shell command, when the action runs one. */
  command: z.string().optional(),
  /** The file the action touches, when it names one. */
  path: z.string().optional(),
});
export type PendingToolCall = z.infer<typeof PendingToolCall>;

/** A permission request the agent is waiting on: enough to show Approve and Deny. */
export const PendingPermissionRequest = z.object({
  /** Pass this to `relay/permission.respond` with one of the option ids. */
  requestId: z.string(),
  options: z.array(PermissionOption),
  toolCall: PendingToolCall,
});
export type PendingPermissionRequest = z.infer<typeof PendingPermissionRequest>;

/** One row of the session list. */
export const SessionSummary = z.object({
  id: SessionId,
  agent: AgentKind,
  status: SessionStatus,
  waitingReason: WaitingReason.optional(),
  title: z.string(),
  repoPath: z.string(),
  branch: z.string(),
  baseBranch: z.string(),
  lastSeq: z.number().int().nonnegative(),
  createdAt: z.iso.datetime({ offset: true }),
  archivedAt: z.iso.datetime({ offset: true }).optional(),
  /** A prompt was sent and its turn has not ended, and the agent is still alive. */
  turnRunning: z.boolean().default(false),
  /** Requests the agent is waiting on, oldest first. Empty once the agent is gone. */
  pendingPermissions: z.array(PendingPermissionRequest).default([]),
});
export type SessionSummary = z.infer<typeof SessionSummary>;
