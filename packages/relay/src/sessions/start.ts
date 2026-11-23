import {
  type AgentKind,
  RawAcpMessage,
  type SessionId,
  type WorktreeSessionParams,
} from "@agentcontrol/protocol";
import {
  type AgentProcess,
  type PermissionAnswer,
  type PermissionRequest,
  firstUseDownload,
  startAgent,
} from "../agents/index.ts";
import type { RepoWithSetup } from "../repos/index.ts";
import { type CreatedWorktree, runSetupScript } from "../worktrees/index.ts";
import type { SessionContext } from "./context.ts";
import { holdForUser } from "./permissions.ts";
import { startTurn } from "./turn.ts";

export interface NewSession {
  sessionId: SessionId;
  repo: RepoWithSetup;
  params: WorktreeSessionParams;
  worktree: CreatedWorktree;
}

/** Everything needed to start one agent process for a session, whatever kind of session it is. */
export interface Launch {
  sessionId: SessionId;
  agent: AgentKind;
  cwd: string;
  env: Record<string, string>;
  sessionMeta?: Record<string, unknown>;
  ask: (request: PermissionRequest) => Promise<PermissionAnswer>;
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

async function connectAgent(ctx: SessionContext, launch: Launch): Promise<AgentProcess> {
  const { sessionId } = launch;
  const agent = await startAgent({
    kind: launch.agent,
    cwd: launch.cwd,
    env: launch.env,
    ...(launch.sessionMeta ? { sessionMeta: launch.sessionMeta } : {}),
    hostEnv: ctx.hostEnv,
    onMessage: tapAcp(ctx, sessionId),
    onPermissionRequest: launch.ask,
  });
  ctx.live.set(sessionId, agent);
  await ctx.log.append(sessionId, { kind: "agent-started", payload: {} });
  watchExit(ctx, sessionId, agent);
  return agent;
}

/**
 * Tells the user that the agent's adapter is being downloaded, when it is (first use only).
 * Returns what to say if that download then fails.
 */
function announceDownload(ctx: SessionContext, launch: Launch): string {
  const download = firstUseDownload(launch.agent, ctx.hostEnv);
  if (download === undefined) return "";
  const payload = { stream: "stdout" as const, text: download.started };
  ctx.record(launch.sessionId, { kind: "setup-output", payload });
  return download.failed;
}

/** `agent-started` is recorded once the ACP handshake is done, so it means the agent is up. */
export async function launchAgent(
  ctx: SessionContext,
  launch: Launch,
): Promise<AgentProcess | undefined> {
  const { sessionId } = launch;
  const ifDownloadFails = announceDownload(ctx, launch);
  try {
    return await connectAgent(ctx, launch);
  } catch (error) {
    const text = `${ifDownloadFails}${reasonOf(error)}\n`;
    await ctx.log.append(sessionId, { kind: "setup-output", payload: { stream: "stderr", text } });
    await ctx.log.append(sessionId, { kind: "agent-exited", payload: { exitCode: 1 } });
    return undefined;
  }
}

async function runSession(ctx: SessionContext, session: NewSession): Promise<void> {
  if (!(await runSetup(ctx, session))) return;
  const { sessionId, worktree } = session;
  const agent = await launchAgent(ctx, {
    sessionId,
    agent: session.params.agent,
    cwd: worktree.worktreePath,
    env: worktree.env,
    ask: (request) => holdForUser(ctx, { sessionId, request }),
  });
  if (!agent) return;
  await startTurn(ctx, { sessionId, agent, text: session.params.prompt });
}

/** Runs everything after the session exists; every failure ends up as events in the log. */
export function runInBackground(ctx: SessionContext, session: NewSession): void {
  runSession(ctx, session).catch((error: unknown) => {
    console.error(`Session ${session.sessionId} failed unexpectedly: ${reasonOf(error)}`);
  });
}
