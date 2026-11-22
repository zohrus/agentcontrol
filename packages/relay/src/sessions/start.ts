import { join } from "node:path";
import { RawAcpMessage, type SessionId, type SessionsCreateParams } from "@agentcontrol/protocol";
import type { z } from "zod";
import { type AgentProcess, startAgent } from "../agents/index.ts";
import type { RepoWithSetup } from "../repos/index.ts";
import { type CreatedWorktree, createWorktree, portBaseFor } from "../worktrees/index.ts";
import type { SessionContext } from "./context.ts";
import { holdForUser } from "./permissions.ts";
import { startTurn } from "./turn.ts";

type CreateParams = z.infer<typeof SessionsCreateParams>;

export interface NewSession {
  sessionId: SessionId;
  repo: RepoWithSetup;
  params: CreateParams;
}

/** Where the session's worktree and branch will be: createWorktree uses the same names. */
export function plannedLocation(ctx: SessionContext, sessionId: SessionId) {
  return {
    worktreePath: join(ctx.worktreesDir, sessionId),
    branch: `agentcontrol/${sessionId}`,
  };
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function prepareWorktree(
  ctx: SessionContext,
  session: NewSession,
): Promise<CreatedWorktree | undefined> {
  const { sessionId, repo, params } = session;
  try {
    const worktree = await createWorktree({
      repoPath: repo.path,
      baseBranch: params.baseBranch,
      sessionId,
      worktreesDir: ctx.worktreesDir,
      setup: repo.setup,
      portBase: portBaseFor(ctx.nextPortIndex()),
      onSetupOutput: (stream, text) => {
        ctx.record(sessionId, { kind: "setup-output", payload: { stream, text } });
      },
    });
    await ctx.log.append(sessionId, {
      kind: "setup-finished",
      payload: { exitCode: worktree.setupExitCode },
    });
    return worktree.setupExitCode === 0 ? worktree : undefined;
  } catch (error) {
    const text = `${reasonOf(error)}\n`;
    await ctx.log.append(sessionId, { kind: "setup-output", payload: { stream: "stderr", text } });
    await ctx.log.append(sessionId, { kind: "setup-finished", payload: { exitCode: 1 } });
    return undefined;
  }
}

function tapAcp(ctx: SessionContext, sessionId: SessionId) {
  return (direction: "to-agent" | "from-agent", raw: unknown): void => {
    const message = RawAcpMessage.safeParse(raw);
    if (message.success) {
      ctx.record(sessionId, { kind: "acp", payload: { direction, message: message.data } });
    }
  };
}

function watchExit(ctx: SessionContext, sessionId: SessionId, agent: AgentProcess): void {
  void agent.exited.then(({ exitCode, signal }) => {
    ctx.live.delete(sessionId);
    const payload = signal === undefined ? { exitCode } : { exitCode, signal };
    ctx.record(sessionId, { kind: "agent-exited", payload });
  });
}

/** `agent-started` is recorded as the launch begins, so the ACP handshake follows it in the log. */
async function launchAgent(
  ctx: SessionContext,
  call: { session: NewSession; worktree: CreatedWorktree },
): Promise<AgentProcess | undefined> {
  const { session, worktree } = call;
  const { sessionId } = session;
  await ctx.log.append(sessionId, { kind: "agent-started", payload: {} });
  try {
    const agent = await startAgent({
      kind: session.params.agent,
      cwd: worktree.worktreePath,
      env: worktree.env,
      onMessage: tapAcp(ctx, sessionId),
      onPermissionRequest: (request) => holdForUser(ctx, { sessionId, request }),
    });
    ctx.live.set(sessionId, agent);
    watchExit(ctx, sessionId, agent);
    return agent;
  } catch (error) {
    const text = `${reasonOf(error)}\n`;
    await ctx.log.append(sessionId, { kind: "setup-output", payload: { stream: "stderr", text } });
    await ctx.log.append(sessionId, { kind: "agent-exited", payload: { exitCode: 1 } });
    return undefined;
  }
}

async function runSession(ctx: SessionContext, session: NewSession): Promise<void> {
  const worktree = await prepareWorktree(ctx, session);
  if (!worktree) return;
  const agent = await launchAgent(ctx, { session, worktree });
  if (!agent) return;
  await startTurn(ctx, { sessionId: session.sessionId, agent, text: session.params.prompt });
}

/** Runs everything after the session exists; every failure ends up as events in the log. */
export function runInBackground(ctx: SessionContext, session: NewSession): void {
  runSession(ctx, session).catch((error: unknown) => {
    console.error(`Session ${session.sessionId} failed unexpectedly: ${reasonOf(error)}`);
  });
}
