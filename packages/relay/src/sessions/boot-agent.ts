import { mkdir } from "node:fs/promises";
import type { SessionId } from "@agentcontrol/protocol";
import { type AgentProcess, type PreparedAgent, prepareAgent } from "../agents/index.ts";
import { agentFailed, registerAgent, tapAcp } from "./connect.ts";
import type { SessionContext } from "./context.ts";
import type { NewSession } from "./make-worktree.ts";
import { holdForUser } from "./permissions.ts";

/** An agent process that is up and waiting for its folder, or why it could not start. */
export type Booted = { prepared: PreparedAgent } | { error: unknown };

/**
 * Starts the agent's process and runs `initialize` at once, while the worktree is still being made:
 * neither needs the folder, and together they are the slowest part of starting that is not git. The
 * process starts in the relay's worktrees folder; only `session/new` is given the session's folder.
 * Never rejects: a failure is returned, and shown once the rest of the setup is done.
 */
export async function bootAgent(ctx: SessionContext, session: NewSession): Promise<Booted> {
  const { sessionId, params, worktree, timed } = session;
  try {
    await mkdir(ctx.worktreesDir, { recursive: true });
    const prepared = await prepareAgent({
      kind: params.agent,
      cwd: ctx.worktreesDir,
      env: worktree.env,
      timed,
      hostEnv: ctx.hostEnv,
      onMessage: (direction, message) => {
        // What an agent says after its session was archived is not part of the session's story.
        if (!archivedMeanwhile(ctx, sessionId)) tapAcp(ctx, sessionId)(direction, message);
      },
      onPermissionRequest: (request) => holdForUser(ctx, { sessionId, request }),
    });
    ctx.preparing.set(sessionId, prepared);
    return { prepared };
  } catch (error) {
    return { error };
  }
}

/** Ends the booted agent when the session will not use it (its folder or setup failed). */
export async function discardBooted(
  ctx: SessionContext,
  call: { sessionId: SessionId; booting: Promise<Booted> },
): Promise<void> {
  const booted = await call.booting;
  if ("error" in booted) return;
  ctx.preparing.delete(call.sessionId);
  await booted.prepared.discard();
}

/** Archived while it was being set up: there is nothing left to run an agent in. */
export const archivedMeanwhile = (ctx: SessionContext, sessionId: SessionId): boolean =>
  ctx.archiving.has(sessionId) || ctx.summaries.summary(sessionId)?.archivedAt !== undefined;

/** The booted agent, when it is there and the session still wants it; a boot failure is shown here. */
async function agentToOpen(
  ctx: SessionContext,
  call: { sessionId: SessionId; booting: Promise<Booted> },
): Promise<PreparedAgent | undefined> {
  const { sessionId } = call;
  const booted = await call.booting;
  const archived = archivedMeanwhile(ctx, sessionId);
  if ("error" in booted) {
    if (!archived) await agentFailed(ctx, { sessionId, error: booted.error });
    return undefined;
  }
  // Ended meanwhile (the relay is stopping, or the session was archived): nothing to open.
  const stillOurs = ctx.preparing.get(sessionId) === booted.prepared;
  ctx.preparing.delete(sessionId);
  if (!archived && stillOurs) return booted.prepared;
  await booted.prepared.discard();
  return undefined;
}

/** Opens the booted agent's session in the made worktree; undefined when there is no agent to use. */
export async function openBooted(
  ctx: SessionContext,
  call: { session: NewSession; booting: Promise<Booted> },
): Promise<AgentProcess | undefined> {
  const { sessionId, worktree } = call.session;
  const prepared = await agentToOpen(ctx, { sessionId, booting: call.booting });
  if (prepared === undefined) return undefined;
  try {
    const agent = await prepared.open({ cwd: worktree.worktreePath });
    return await registerAgent(ctx, { sessionId, agent });
  } catch (error) {
    await agentFailed(ctx, { sessionId, error });
    return undefined;
  }
}
