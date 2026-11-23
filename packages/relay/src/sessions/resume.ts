import { ErrorCode, type SessionId, type SessionSummary } from "@agentcontrol/protocol";
import type { AgentProcess } from "../agents/index.ts";
import { RelayError } from "../rpc/index.ts";
import { type SessionContext, type SessionInfo, sessionInfo } from "./context.ts";
import { holdForUser } from "./permissions.ts";
import { shellTarget } from "./shell-target.ts";
import { connectAgent } from "./start.ts";
import { liveAgent } from "./turn.ts";

const refuse = (code: ErrorCode, message: string): RelayError => new RelayError(code, message);

interface Facts {
  info: SessionInfo;
  summary: SessionSummary | undefined;
  running: boolean;
}

/** One rule per reason a session cannot be resumed, in the order they are checked. */
const refusals: ((facts: Facts) => RelayError | undefined)[] = [
  ({ summary }) =>
    summary?.archivedAt === undefined
      ? undefined
      : refuse(ErrorCode.sessionArchived, "This session was archived, so it cannot be resumed."),
  ({ info }) =>
    info.kind === "directory"
      ? refuse(ErrorCode.invalidParams, "A Modify session cannot be resumed: ask again.")
      : undefined,
  ({ running }) =>
    running
      ? refuse(ErrorCode.invalidParams, "This session's agent is already running.")
      : undefined,
  ({ summary }) =>
    summary?.status === "interrupted"
      ? undefined
      : refuse(ErrorCode.invalidParams, "This session was not interrupted: nothing to resume."),
];

/** Throws the plain reason this session cannot be resumed; returns when it can. */
async function checkResumable(ctx: SessionContext, sessionId: SessionId): Promise<void> {
  const info = await sessionInfo(ctx, sessionId);
  const facts = {
    info,
    summary: ctx.summaries.summary(sessionId),
    running: ctx.live.has(sessionId),
  };
  const refusal = refusals.map((rule) => rule(facts)).find((found) => found !== undefined);
  if (refusal !== undefined) throw refusal;
}

/** The id the agent gave the session when it last started, from the log; undefined in old logs. */
async function agentSessionIdOf(ctx: SessionContext, sessionId: SessionId) {
  const events = await ctx.log.readAfter(sessionId, 0);
  const started = events.findLast((event) => event.kind === "agent-started");
  return started?.kind === "agent-started" ? started.payload.agentSessionId : undefined;
}

/** What the user is told about what the new agent remembers. */
function noteFor(agent: AgentProcess): string {
  if (agent.restored)
    return "The agent loaded the earlier conversation, so it remembers the work so far.";
  const why = agent.notRestoredBecause ?? "the log does not name the agent's earlier session";
  return `Earlier context was not restored: ${why}. The agent starts a fresh conversation in the same folder.`;
}

async function startAgain(ctx: SessionContext, sessionId: SessionId): Promise<AgentProcess> {
  await checkResumable(ctx, sessionId);
  const { cwd, env } = await shellTarget(ctx, sessionId);
  const agentSessionId = await agentSessionIdOf(ctx, sessionId);
  const agent = await connectAgent(ctx, {
    sessionId,
    agent: ctx.summaries.summary(sessionId)?.agent ?? "mock",
    cwd,
    env,
    ask: (request) => holdForUser(ctx, { sessionId, request }),
    ...(agentSessionId === undefined ? {} : { resume: { agentSessionId } }),
  });
  const payload = { contextRestored: agent.restored, note: noteFor(agent) };
  await ctx.log.append(sessionId, { kind: "session-resumed", payload });
  return agent;
}

/**
 * Starts a new agent for an interrupted session, in the same worktree, continuing the agent's own
 * session when it can load one. Two requests at once share one start. Fails with the plain reason
 * when the session is unknown, archived, a Modify session, running, or was not interrupted.
 */
export function resumeSession(ctx: SessionContext, sessionId: SessionId): Promise<AgentProcess> {
  const running = ctx.resuming.get(sessionId);
  if (running !== undefined) return running;
  const started = startAgain(ctx, sessionId).finally(() => ctx.resuming.delete(sessionId));
  ctx.resuming.set(sessionId, started);
  return started;
}

/** The agent to send a prompt to: the live one, or a resumed one when the session was interrupted. */
export async function agentToPrompt(
  ctx: SessionContext,
  sessionId: SessionId,
): Promise<AgentProcess> {
  const live = ctx.live.get(sessionId);
  if (live !== undefined) return live;
  const interrupted = ctx.summaries.summary(sessionId)?.status === "interrupted";
  return interrupted ? resumeSession(ctx, sessionId) : liveAgent(ctx, sessionId);
}
