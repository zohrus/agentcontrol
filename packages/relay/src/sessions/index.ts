import {
  type EventsSubscribeParams,
  type SessionEvent,
  type SessionId,
  type SessionsCreateParams,
  type SessionSummary,
} from "@agentcontrol/protocol";
import type { z } from "zod";
import { withNormalised } from "../acp-normalise/index.ts";
import type { AgentProcess, HostEnv } from "../agents/index.ts";
import type { EventLog } from "../event-log/index.ts";
import { createPendingPermissions } from "../permissions/index.ts";
import type { RepoStore } from "../repos/index.ts";
import { archiveSession } from "./archive.ts";
import { type SessionContext, type SessionInfo, sessionInfo } from "./context.ts";
import { createWorktreeSession } from "./create.ts";
import { createDirectorySession } from "./directory.ts";
import { answerRequest, cancelRequests } from "./permissions.ts";
import { interruptSession, recoverSessions } from "./recovery.ts";
import { shellTarget } from "./shell-target.ts";
import { createLiveSummaries, type LiveSummaries } from "./live-summaries.ts";
import { followEvents, followSummaries } from "./subscribe.ts";
import { agentToPrompt, resumeSession } from "./resume.ts";
import { liveAgent, startTurn } from "./turn.ts";
import { lacksWorktree } from "./worktree-state.ts";

type CreateParams = z.infer<typeof SessionsCreateParams>;
type ArchiveResult = Awaited<ReturnType<typeof archiveSession>>;

export interface Sessions {
  create(params: CreateParams): Promise<SessionId>;
  prompt(call: { sessionId: SessionId; text: string }): Promise<void>;
  cancel(sessionId: SessionId): Promise<void>;
  respond(call: { sessionId: SessionId; requestId: string; optionId: string }): Promise<void>;
  archive(call: { sessionId: SessionId; force: boolean }): Promise<ArchiveResult>;
  /** Starts a new agent for an interrupted session; says whether it remembers the earlier work. */
  resume(sessionId: SessionId): Promise<{ contextRestored: boolean }>;
  /** Every session's summary, oldest first, from memory. */
  list(): Promise<SessionSummary[]>;
  /**
   * Calls `send` with the summaries that change from now on (only the followed session's when
   * `sessionId` is given); returns how to stop.
   */
  followSummaries(
    sessionId: SessionId | undefined,
    send: (summaries: SessionSummary[]) => void,
  ): () => void;
  /** Where the session's worktree is; fails with sessionNotFound for an unknown session. */
  info(sessionId: SessionId): Promise<SessionInfo>;
  /** Resolves once the session's worktree exists (true), or is known not to be made (false). */
  worktreeMade(sessionId: SessionId): Promise<boolean>;
  /** True while the session's worktree is being made, and for good when it could not be made. */
  lacksWorktree(sessionId: SessionId): boolean;
  /** The folder and variables a terminal of the session starts with; fails for an archived session. */
  shellTarget(sessionId: SessionId): Promise<{ cwd: string; env: Record<string, string> }>;
  /** Every event of the session, with normalised updates; fails with sessionNotFound for an unknown session. */
  events(sessionId: SessionId): Promise<SessionEvent[]>;
  /** Replays events after the client's cursors, then streams new ones; returns how to stop. */
  follow(
    params: z.infer<typeof EventsSubscribeParams>,
    send: (event: SessionEvent) => void,
  ): Promise<() => void>;
  /** Stops every running agent and waits for their last events to be written. */
  shutdown(): Promise<void>;
}

/** Creates a session: in a worktree, or (the Modify agent's) in a plain folder. */
function create(ctx: SessionContext, params: CreateParams): Promise<SessionId> {
  return "kind" in params
    ? createDirectorySession(ctx, params)
    : createWorktreeSession(ctx, params);
}

async function resume(ctx: SessionContext, sessionId: SessionId) {
  return { contextRestored: (await resumeSession(ctx, sessionId)).restored };
}

async function shutdown(ctx: SessionContext): Promise<void> {
  const ids = [...ctx.live.keys()];
  // Each stop returns once the agent's last messages were reported; waiting on `lastSeq` then
  // waits for every append queued for the session, so nothing the agent said is lost.
  await Promise.all([...ctx.live.values()].map((agent) => agent.stop()));
  await Promise.all(ids.map((id) => ctx.log.lastSeq(id)));
  // The agents were stopped by the relay stopping, not by the user: they read as interrupted.
  for (const id of ids) await interruptSession(ctx.log, id);
  ctx.stopRecording();
}

async function cancel(ctx: SessionContext, sessionId: SessionId): Promise<void> {
  const agent = await liveAgent(ctx, sessionId);
  await cancelRequests(ctx, sessionId);
  await agent.cancel();
}

async function prompt(ctx: SessionContext, call: { sessionId: SessionId; text: string }) {
  const agent = await agentToPrompt(ctx, call.sessionId);
  await startTurn(ctx, { ...call, agent });
}

/** What the relay holds about sessions that are running, being made or being resumed: all empty at first. */
function inFlightSessions() {
  return {
    live: new Map<SessionId, AgentProcess>(),
    creating: new Map<SessionId, Promise<boolean>>(),
    claimed: new Set<SessionId>(),
    archiving: new Set<SessionId>(),
    resuming: new Map<SessionId, Promise<AgentProcess>>(),
  };
}

function contextOf(options: {
  log: EventLog;
  repos: RepoStore;
  worktreesDir: string;
  hostEnv: HostEnv;
  sessionCount: number;
  summaries: LiveSummaries;
  endTerminals: SessionContext["endTerminals"];
}): SessionContext {
  let portIndex = options.sessionCount;
  let recording = true;
  const { log, repos, worktreesDir, hostEnv, summaries, endTerminals } = options;
  return {
    ...{ log, repos, worktreesDir, hostEnv, summaries, endTerminals },
    permissions: createPendingPermissions(),
    ...inFlightSessions(),
    stopRecording: () => {
      recording = false;
    },
    record: (sessionId, input) => {
      if (!recording) return;
      log.append(sessionId, input).catch((error: unknown) => {
        console.error(`Could not record an event for session ${sessionId}: ${String(error)}`);
      });
    },
    nextPortIndex: () => portIndex++,
  };
}

/** Every event of the session, with normalised updates; fails for an unknown session. */
async function eventsOf(ctx: SessionContext, sessionId: SessionId): Promise<SessionEvent[]> {
  await sessionInfo(ctx, sessionId);
  return (await ctx.log.readAfter(sessionId, 0)).map(withNormalised);
}

/** Starts the session lifecycle on top of the event log; first repairs sessions a restart cut off. */
export async function createSessions(options: {
  log: EventLog;
  repos: RepoStore;
  worktreesDir: string;
  hostEnv: HostEnv;
  /** Ends a session's terminals, before its folder is removed. */
  endTerminals: SessionContext["endTerminals"];
}): Promise<Sessions> {
  const ids = await recoverSessions(options.log);
  const summaries = await createLiveSummaries({ log: options.log, sessionIds: ids });
  const ctx = contextOf({ ...options, sessionCount: ids.length, summaries });
  return {
    create: (params) => create(ctx, params),
    prompt: (call) => prompt(ctx, call),
    cancel: (sessionId) => cancel(ctx, sessionId),
    respond: (call) => answerRequest(ctx, call),
    archive: (call) => archiveSession(ctx, call),
    resume: (sessionId) => resume(ctx, sessionId),
    list: () => Promise.resolve(summaries.list()),
    followSummaries: (sessionId, send) => followSummaries({ summaries, sessionId, send }),
    info: (sessionId) => sessionInfo(ctx, sessionId),
    worktreeMade: async (sessionId) => (await ctx.creating.get(sessionId)) ?? true,
    lacksWorktree: (sessionId) => lacksWorktree(ctx, sessionId),
    shellTarget: (sessionId) => shellTarget(ctx, sessionId),
    events: (sessionId) => eventsOf(ctx, sessionId),
    follow: (params, send) => followEvents({ log: options.log, params, send }),
    shutdown: () => shutdown(ctx),
  };
}
