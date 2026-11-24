import type { SessionId, WorktreeSessionParams } from "@agentcontrol/protocol";
import type { RepoWithSetup } from "../repos/index.ts";
import type { Timed } from "../steps/index.ts";
import {
  addWorktree,
  namedBase,
  type PlannedWorktree,
  resolveStartPoint,
} from "../worktrees/index.ts";
import type { SessionContext } from "./context.ts";

/** What the relay needs to set a new session up after it was created. */
export interface NewSession {
  sessionId: SessionId;
  repo: RepoWithSetup;
  params: WorktreeSessionParams;
  /** Where the worktree will be; it does not exist yet when the session is created. */
  worktree: PlannedWorktree;
  /** Shows each step of setting the session up, with how long it took. */
  timed: Timed;
}

/** An error as one plain sentence. */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One plain line in the session's setup output, for the user to read while the session starts. */
async function say(ctx: SessionContext, call: { sessionId: SessionId; text: string }) {
  const payload = { stream: "stdout" as const, text: `${call.text}\n` };
  await ctx.log.append(call.sessionId, { kind: "setup-output", payload });
}

/** Finds where the worktree starts from, saying so; records it when the user named no branch. */
async function startPointOf(ctx: SessionContext, session: NewSession): Promise<string> {
  const { sessionId, repo, params, timed } = session;
  const named = namedBase(params.baseBranch) !== "";
  const start = await resolveStartPoint({
    repoPath: repo.path,
    baseBranch: params.baseBranch,
    timed,
  });
  for (const text of start.notes) await say(ctx, { sessionId, text });
  if (!named) {
    await ctx.log.append(sessionId, { kind: "base-resolved", payload: { baseBranch: start.ref } });
  }
  return start.ref;
}

/** Makes the worktree; true when it exists. A failure is shown as a failed setup, never thrown. */
async function makeWorktree(ctx: SessionContext, session: NewSession): Promise<boolean> {
  const { sessionId, repo, worktree, timed } = session;
  try {
    const startRef = await startPointOf(ctx, session);
    await addWorktree({
      repoPath: repo.path,
      planned: worktree,
      startRef,
      setup: repo.setup,
      timed,
    });
    return true;
  } catch (error) {
    const text = `${reasonOf(error)}\n`;
    await ctx.log.append(sessionId, { kind: "setup-output", payload: { stream: "stderr", text } });
    await ctx.log.append(sessionId, { kind: "setup-finished", payload: { exitCode: 1 } });
    return false;
  }
}

/** Makes the worktree and lets whatever needs the folder wait for it (see `SessionContext.creating`). */
export function makeWorktreeAndShare(ctx: SessionContext, session: NewSession): Promise<boolean> {
  const { sessionId } = session;
  // A log that cannot be written is the one way making fails for real; it must not reject for waiters.
  const making = makeWorktree(ctx, session).catch((error: unknown) => {
    console.error(`Session ${sessionId} could not be set up: ${reasonOf(error)}`);
    return false;
  });
  ctx.creating.set(sessionId, making);
  // A worktree that was made is forgotten; one that could not be is remembered as not there.
  void making.then((made) => made && ctx.creating.delete(sessionId));
  return making;
}
