import { RawAcpMessage, type SessionId, type SessionsCreateParams } from "@agentcontrol/protocol";
import type { z } from "zod";
import { type AgentProcess, startAgent } from "../agents/index.ts";
import type { RepoWithSetup } from "../repos/index.ts";
import { type CreatedWorktree, runSetupScript } from "../worktrees/index.ts";
import type { SessionContext } from "./context.ts";
import { holdForUser } from "./permissions.ts";
import { startTurn } from "./turn.ts";

type CreateParams = z.infer<typeof SessionsCreateParams>;

export interface NewSession {
  sessionId: SessionId;
  repo: RepoWithSetup;
  params: CreateParams;
  worktree: CreatedWorktree;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs the repo's setup script in the new worktree; true when it succeeded. */
async function runSetup(ctx: SessionContext, session: NewSession): Promise<boolean> {
  const { sessionId, repo, worktree } = session;
  const exitCode = await runSetupScript({
    script: repo.setup.setupScript,
    cwd: worktree.worktreePath,
    env: worktree.env,
    onOutput: (stream, text) => {
      ctx.record(sessionId, { kind: "setup-output", payload: { stream, text } });
    },
  }).catch(async (error: unknown) => {
    await ctx.log.append(sessionId, {
      kind: "setup-output",
      payload: { stream: "stderr", text: `${reasonOf(error)}\n` },
    });
    return 1;
  });
  await ctx.log.append(sessionId, { kind: "setup-finished", payload: { exitCode } });
  return exitCode === 0;
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

/** `agent-started` is recorded once the ACP handshake is done, so it means the agent is up. */
async function launchAgent(
  ctx: SessionContext,
  session: NewSession,
): Promise<AgentProcess | undefined> {
  const { sessionId, worktree } = session;
  try {
    const agent = await startAgent({
      kind: session.params.agent,
      cwd: worktree.worktreePath,
      env: worktree.env,
      onMessage: tapAcp(ctx, sessionId),
      onPermissionRequest: (request) => holdForUser(ctx, { sessionId, request }),
    });
    ctx.live.set(sessionId, agent);
    await ctx.log.append(sessionId, { kind: "agent-started", payload: {} });
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
  if (!(await runSetup(ctx, session))) return;
  const agent = await launchAgent(ctx, session);
  if (!agent) return;
  await startTurn(ctx, { sessionId: session.sessionId, agent, text: session.params.prompt });
}

/** Runs everything after the session exists; every failure ends up as events in the log. */
export function runInBackground(ctx: SessionContext, session: NewSession): void {
  runSession(ctx, session).catch((error: unknown) => {
    console.error(`Session ${session.sessionId} failed unexpectedly: ${reasonOf(error)}`);
  });
}
