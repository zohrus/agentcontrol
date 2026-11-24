import { type AgentKind, RawAcpMessage, type SessionId } from "@agentcontrol/protocol";
import {
  type AgentProcess,
  type PermissionAnswer,
  type PermissionRequest,
  startAgent,
} from "../agents/index.ts";
import type { Timed } from "../steps/index.ts";
import type { SessionContext } from "./context.ts";
import { reasonOf } from "./make-worktree.ts";

/** Everything needed to start one agent process for a session, whatever kind of session it is. */
export interface Launch {
  sessionId: SessionId;
  agent: AgentKind;
  cwd: string;
  env: Record<string, string>;
  sessionMeta?: Record<string, unknown>;
  /** Continue this earlier agent session (resuming an interrupted one) rather than start afresh. */
  resume?: { agentSessionId: string };
  /** Shows the steps of starting the agent with their times; none are shown without it. */
  timed?: Timed;
  ask: (request: PermissionRequest) => Promise<PermissionAnswer>;
}

/** Records every ACP message of the session's agent in its log, in wire order. */
export function tapAcp(ctx: SessionContext, sessionId: SessionId) {
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

/** Makes the agent the session's running one and records `agent-started`: it is up and its handshake is done. */
export async function registerAgent(
  ctx: SessionContext,
  call: { sessionId: SessionId; agent: AgentProcess },
): Promise<AgentProcess> {
  const { sessionId, agent } = call;
  ctx.live.set(sessionId, agent);
  const payload = { agentSessionId: agent.agentSessionId };
  await ctx.log.append(sessionId, { kind: "agent-started", payload });
  watchExit(ctx, sessionId, agent);
  return agent;
}

/** Starts the agent and records `agent-started` once its handshake is done. */
export async function connectAgent(ctx: SessionContext, launch: Launch): Promise<AgentProcess> {
  const { sessionId } = launch;
  const agent = await startAgent({
    kind: launch.agent,
    cwd: launch.cwd,
    env: launch.env,
    ...(launch.sessionMeta ? { sessionMeta: launch.sessionMeta } : {}),
    ...(launch.resume ? { resume: launch.resume } : {}),
    ...(launch.timed ? { timed: launch.timed } : {}),
    hostEnv: ctx.hostEnv,
    onMessage: tapAcp(ctx, sessionId),
    onPermissionRequest: launch.ask,
  });
  return registerAgent(ctx, { sessionId, agent });
}

/** Says why the agent could not start, in the session's setup output, and records that it ended. */
export async function agentFailed(
  ctx: SessionContext,
  call: { sessionId: SessionId; error: unknown },
): Promise<void> {
  const { sessionId } = call;
  const text = `${reasonOf(call.error)}\n`;
  await ctx.log.append(sessionId, { kind: "setup-output", payload: { stream: "stderr", text } });
  await ctx.log.append(sessionId, { kind: "agent-exited", payload: { exitCode: 1 } });
}

/** Starts the agent; a failure is shown in the session, never thrown. Undefined when it did not start. */
export async function launchAgent(
  ctx: SessionContext,
  launch: Launch,
): Promise<AgentProcess | undefined> {
  try {
    return await connectAgent(ctx, launch);
  } catch (error) {
    await agentFailed(ctx, { sessionId: launch.sessionId, error });
    return undefined;
  }
}
