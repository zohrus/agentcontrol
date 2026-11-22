import { z } from "zod";
import { AgentKind, SessionId, SessionStatus, WaitingReason } from "../ids/index.ts";

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
});
export type SessionSummary = z.infer<typeof SessionSummary>;
