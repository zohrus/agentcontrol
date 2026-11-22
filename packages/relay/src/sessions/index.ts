import {
  type EventsSubscribeParams,
  type SessionEvent,
  SessionId,
  type SessionsCreateParams,
  type SessionSummary,
} from "@agentcontrol/protocol";
import type { z } from "zod";
import { withNormalised } from "../acp-normalise/index.ts";
import type { EventLog } from "../event-log/index.ts";
import { createPendingPermissions } from "../permissions/index.ts";
import type { RepoStore } from "../repos/index.ts";
import { createWorktree, portBaseFor } from "../worktrees/index.ts";
import { archiveSession } from "./archive.ts";
import { type SessionContext, type SessionInfo, sessionInfo } from "./context.ts";
import { answerRequest, cancelRequests } from "./permissions.ts";
import { recoverSessions } from "./recovery.ts";
import { runInBackground } from "./start.ts";
import { createLiveSummaries, type LiveSummaries } from "./live-summaries.ts";
import { followEvents, followSummaries } from "./subscribe.ts";
import { liveAgent, startTurn } from "./turn.ts";

type CreateParams = z.infer<typeof SessionsCreateParams>;
type ArchiveResult = Awaited<ReturnType<typeof archiveSession>>;

export interface Sessions {
  create(params: CreateParams): Promise<SessionId>;
  prompt(call: { sessionId: SessionId; text: string }): Promise<void>;
  cancel(sessionId: SessionId): Promise<void>;
  respond(call: { sessionId: SessionId; requestId: string; optionId: string }): Promise<void>;
  archive(call: { sessionId: SessionId; force: boolean }): Promise<ArchiveResult>;
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

function titleOf(params: CreateParams): string {
  const firstLine = params.title ?? params.prompt.split("\n")[0] ?? "";
  return firstLine.slice(0, 80);
}

async function create(ctx: SessionContext, params: CreateParams): Promise<SessionId> {
  const repo =
    (await ctx.repos.findByPath(params.repoPath)) ?? (await ctx.repos.add(params.repoPath));
  const sessionId = SessionId.parse(crypto.randomUUID());
  const worktree = await createWorktree({
    repoPath: repo.path,
    baseBranch: params.baseBranch,
    sessionId,
    worktreesDir: ctx.worktreesDir,
    setup: repo.setup,
    portBase: portBaseFor(ctx.nextPortIndex()),
  });
  const { worktreePath, branch } = worktree;
  const created = { agent: params.agent, repoPath: repo.path, baseBranch: params.baseBranch };
  const title = titleOf(params);
  await ctx.log.append(sessionId, {
    kind: "session-created",
    payload: { ...created, title, worktreePath, branch },
  });
  runInBackground(ctx, { sessionId, repo, params, worktree });
  return sessionId;
}

async function shutdown(ctx: SessionContext): Promise<void> {
  const ids = [...ctx.live.keys()];
  await Promise.all([...ctx.live.values()].map((agent) => agent.stop()));
  await Promise.all(ids.map((id) => ctx.log.lastSeq(id)));
}

async function cancel(ctx: SessionContext, sessionId: SessionId): Promise<void> {
  const agent = await liveAgent(ctx, sessionId);
  await cancelRequests(ctx, sessionId);
  await agent.cancel();
}

async function prompt(ctx: SessionContext, call: { sessionId: SessionId; text: string }) {
  const agent = await liveAgent(ctx, call.sessionId);
  await startTurn(ctx, { ...call, agent });
}

function contextOf(options: {
  log: EventLog;
  repos: RepoStore;
  worktreesDir: string;
  sessionCount: number;
  summaries: LiveSummaries;
}): SessionContext {
  let portIndex = options.sessionCount;
  const { log } = options;
  return {
    log,
    repos: options.repos,
    worktreesDir: options.worktreesDir,
    permissions: createPendingPermissions(),
    summaries: options.summaries,
    live: new Map(),
    record: (sessionId, input) => {
      log.append(sessionId, input).catch((error: unknown) => {
        console.error(`Could not record an event for session ${sessionId}: ${String(error)}`);
      });
    },
    nextPortIndex: () => portIndex++,
  };
}

/** Starts the session lifecycle on top of the event log; first repairs sessions a restart cut off. */
export async function createSessions(options: {
  log: EventLog;
  repos: RepoStore;
  worktreesDir: string;
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
    list: () => Promise.resolve(summaries.list()),
    followSummaries: (sessionId, send) => followSummaries({ summaries, sessionId, send }),
    info: (sessionId) => sessionInfo(ctx, sessionId),
    events: async (sessionId) => {
      await sessionInfo(ctx, sessionId);
      return (await options.log.readAfter(sessionId, 0)).map(withNormalised);
    },
    follow: (params, send) => followEvents({ log: options.log, params, send }),
    shutdown: () => shutdown(ctx),
  };
}
