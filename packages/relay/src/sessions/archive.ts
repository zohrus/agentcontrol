import type { SessionId, SessionsArchiveResult } from "@agentcontrol/protocol";
import type { z } from "zod";
import { workdirOf } from "../workdirs/index.ts";
import { type SessionContext, type SessionInfo, sessionInfo } from "./context.ts";
import { cancelRequests } from "./permissions.ts";

type ArchiveResult = z.infer<typeof SessionsArchiveResult>;

async function stopAgent(ctx: SessionContext, sessionId: SessionId): Promise<void> {
  await cancelRequests(ctx, sessionId);
  await ctx.live.get(sessionId)?.stop();
}

async function tearDown(ctx: SessionContext, call: { sessionId: SessionId; info: SessionInfo }) {
  const { sessionId, info } = call;
  await stopAgent(ctx, sessionId);
  await workdirOf(info).remove();
  await ctx.log.append(sessionId, { kind: "session-archived", payload: {} });
}

/** Stops the agent, removes the worktree (the branch stays) and records `session-archived`. */
export async function archiveSession(
  ctx: SessionContext,
  call: { sessionId: SessionId; force: boolean },
): Promise<ArchiveResult> {
  const { sessionId } = call;
  const info = await sessionInfo(ctx, sessionId);
  if (ctx.summaries.summary(sessionId)?.archivedAt !== undefined) return { archived: true };
  const files = await workdirOf(info).uncommitted();
  if (files.length > 0 && !call.force) return { archived: false, uncommittedFiles: files };
  await tearDown(ctx, { sessionId, info });
  return { archived: true };
}
