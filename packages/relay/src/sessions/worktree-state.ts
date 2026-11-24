import { existsSync } from "node:fs";
import type { SessionId } from "@agentcontrol/protocol";
import type { SessionContext } from "./context.ts";

/** The session's own folder is gone (never made, or removed behind the relay's back). */
function folderIsMissing(ctx: SessionContext, sessionId: SessionId): boolean {
  const created = ctx.summaries.created(sessionId)?.payload;
  if (created === undefined || created.kind === "directory") return false;
  return !existsSync(created.worktreePath);
}

/**
 * Whether the session has no folder to read: its worktree is being made, could not be made, or is
 * missing (also after a relay restart). An archived session's folder is gone on purpose.
 */
export function lacksWorktree(ctx: SessionContext, sessionId: SessionId): boolean {
  if (ctx.creating.has(sessionId)) return true;
  const archived = ctx.summaries.summary(sessionId)?.archivedAt !== undefined;
  return !archived && folderIsMissing(ctx, sessionId);
}
