import { ErrorCode, type SessionId } from "@agentcontrol/protocol";
import { RelayError } from "../rpc/index.ts";
import { portEnv } from "../worktrees/index.ts";
import { type SessionContext, sessionInfo } from "./context.ts";

/**
 * Where a terminal for the session starts, and the variables the session's own commands get (its
 * ports). Fails with sessionNotFound for an unknown session and sessionArchived for one whose
 * folder was removed.
 */
export async function shellTarget(
  ctx: SessionContext,
  sessionId: SessionId,
): Promise<{ cwd: string; env: Record<string, string> }> {
  const info = await sessionInfo(ctx, sessionId);
  if (ctx.summaries.summary(sessionId)?.archivedAt !== undefined) {
    throw new RelayError(ErrorCode.sessionArchived, "This session was archived: it has no folder.");
  }
  const env = info.portBase === undefined ? {} : portEnv(info.portBase);
  return { cwd: info.worktreePath, env };
}
