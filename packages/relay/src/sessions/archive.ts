import type { SessionId, SessionsArchiveResult } from "@agentcontrol/protocol";
import type { z } from "zod";
import type { Timed } from "../steps/index.ts";
import { workdirOf } from "../workdirs/index.ts";
import { type SessionContext, type SessionInfo, sessionInfo } from "./context.ts";
import { deleteInBackground } from "./delete-aside.ts";
import { cancelRequests } from "./permissions.ts";
import { reportFinished, timedFor } from "./timed.ts";

type ArchiveResult = z.infer<typeof SessionsArchiveResult>;

/** Ends the session's agent; false when there was none. */
async function stopAgent(ctx: SessionContext, sessionId: SessionId): Promise<boolean> {
  await cancelRequests(ctx, sessionId);
  // An agent that was still waiting for its folder is ended too.
  const running = ctx.live.get(sessionId) ?? ctx.preparing.get(sessionId);
  ctx.preparing.delete(sessionId);
  if (running === undefined) return false;
  await ("discard" in running ? running.discard() : running.stop());
  return true;
}

/** Stops the agent and closes what the user has open on the folder, so nothing uses it while it is removed. */
async function releaseFolder(ctx: SessionContext, call: { sessionId: SessionId; timed: Timed }) {
  const { sessionId, timed } = call;
  const stopping = {
    id: "stop-agent",
    doing: "Stopping the agent",
    done: (stopped: boolean) => (stopped ? "Stopped the agent" : "No agent was running"),
  };
  await timed(stopping, () => stopAgent(ctx, sessionId));
  // A shell or a watcher it started would otherwise keep using the folder while it is removed.
  const closing = { id: "terminals", doing: "Closing terminals", done: "Closed terminals" };
  await timed(closing, () => ctx.endTerminals(sessionId));
}

async function tearDown(ctx: SessionContext, call: { sessionId: SessionId; info: SessionInfo }) {
  const { sessionId, info } = call;
  const timed = timedFor(ctx, { sessionId, phase: "archive" });
  ctx.archiving.add(sessionId);
  try {
    await releaseFolder(ctx, { sessionId, timed });
    const removing = {
      id: "remove",
      doing: "Removing the worktree",
      done: (removal: { pending: boolean; finish(): Promise<void> }) =>
        removal.pending
          ? "Removed the worktree (its folder is deleted in the background)"
          : "Removed the worktree",
    };
    const removal = await timed(removing, () => workdirOf(info).remove());
    await ctx.log.append(sessionId, { kind: "session-archived", payload: {} });
    deleteInBackground(ctx, { sessionId, removal });
  } finally {
    ctx.archiving.delete(sessionId);
  }
}

/**
 * The files that would be lost, or none when the archive may go on (nothing changed, or the user
 * chose to archive anyway); the time the check took is told once it is known the archive goes on.
 */
async function lostFiles(
  ctx: SessionContext,
  call: { sessionId: SessionId; info: SessionInfo; force: boolean },
): Promise<string[]> {
  const { sessionId, info } = call;
  const elapsed = ctx.stopwatch();
  const files = await workdirOf(info).uncommitted();
  const durationMs = elapsed();
  if (files.length > 0 && !call.force) return files;
  const label =
    files.length === 0
      ? "No uncommitted changes"
      : `${String(files.length)} uncommitted ${files.length === 1 ? "file" : "files"}, archived anyway`;
  await reportFinished(ctx, { sessionId, phase: "archive", id: "uncommitted", label, durationMs });
  return [];
}

/**
 * Stops the agent, removes the worktree (the branch stays) and records `session-archived`. The
 * worktree's files are deleted after that, in the background: archiving does not wait for them.
 */
export async function archiveSession(
  ctx: SessionContext,
  call: { sessionId: SessionId; force: boolean },
): Promise<ArchiveResult> {
  const { sessionId } = call;
  const info = await sessionInfo(ctx, sessionId);
  // A session still being made is archived once its worktree exists, so nothing is removed halfway.
  await ctx.creating.get(sessionId);
  if (ctx.summaries.summary(sessionId)?.archivedAt !== undefined) return { archived: true };
  const uncommittedFiles = await lostFiles(ctx, { sessionId, info, force: call.force });
  if (uncommittedFiles.length > 0) return { archived: false, uncommittedFiles };
  await tearDown(ctx, { sessionId, info });
  return { archived: true };
}
