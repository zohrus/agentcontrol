import type {
  EventKind,
  SessionEvent,
  SessionStatus,
  SessionSummary,
  WaitingReason,
} from "@agentcontrol/protocol";

type EventOf<K extends EventKind> = Extract<SessionEvent, { kind: K }>;

/** Everything the session list needs, built up by folding the events in order. */
interface Fold {
  created: EventOf<"session-created"> | undefined;
  lastSeq: number;
  setupExitCode: number | undefined;
  agentStarted: boolean;
  exitCode: number | null | undefined;
  turnOpen: boolean;
  lastStopReason: string | undefined;
  unansweredRequests: string[];
  archivedAt: string | undefined;
}

type Reducers = { [K in EventKind]: (fold: Fold, event: EventOf<K>) => Fold };

/** One small reducer per event kind. */
const reducers: Reducers = {
  acp: (fold) => fold,
  "setup-output": (fold) => fold,
  "session-created": (fold, event) => ({ ...fold, created: event }),
  "setup-finished": (fold, event) => ({ ...fold, setupExitCode: event.payload.exitCode }),
  "agent-started": (fold) => ({ ...fold, agentStarted: true }),
  "agent-exited": (fold, event) => ({
    ...fold,
    exitCode: event.payload.exitCode,
    unansweredRequests: [],
  }),
  "permission-requested": (fold, event) => ({
    ...fold,
    unansweredRequests: [...fold.unansweredRequests, event.payload.requestId],
  }),
  "permission-answered": (fold, event) => ({
    ...fold,
    unansweredRequests: fold.unansweredRequests.filter((id) => id !== event.payload.requestId),
  }),
  "prompt-sent": (fold) => ({ ...fold, turnOpen: true, lastStopReason: undefined }),
  "turn-ended": (fold, event) => ({
    ...fold,
    turnOpen: false,
    lastStopReason: event.payload.stopReason,
  }),
  "session-archived": (fold, event) => ({ ...fold, archivedAt: event.ts }),
};

function reduce(fold: Fold, event: SessionEvent): Fold {
  const reducer = reducers[event.kind] as (fold: Fold, event: SessionEvent) => Fold;
  return { ...reducer(fold, event), lastSeq: event.seq };
}

interface Status {
  status: SessionStatus;
  waitingReason?: WaitingReason;
}

const archived = (fold: Fold): Status | undefined =>
  fold.archivedAt === undefined ? undefined : { status: "archived" };

/** The agent died during a turn, or before it ever finished one. A restart kills agents too. */
const failed = (fold: Fold): Status | undefined => {
  const exitedBadly = fold.exitCode !== undefined && fold.exitCode !== 0;
  const neverFinishedTurn = fold.turnOpen || fold.lastStopReason === undefined;
  return exitedBadly && neverFinishedTurn ? { status: "failed" } : undefined;
};

const setupFailed = (fold: Fold): Status | undefined =>
  fold.setupExitCode !== undefined && fold.setupExitCode !== 0 && !fold.agentStarted
    ? { status: "waiting", waitingReason: "setup-failed" }
    : undefined;

const needsPermission = (fold: Fold): Status | undefined =>
  fold.unansweredRequests.length > 0
    ? { status: "waiting", waitingReason: "permission" }
    : undefined;

const running = (fold: Fold): Status | undefined => {
  const working = fold.turnOpen || fold.lastStopReason === undefined;
  return fold.agentStarted && fold.exitCode === undefined && working
    ? { status: "running" }
    : undefined;
};

const needsReply = (fold: Fold): Status | undefined =>
  fold.exitCode === undefined && fold.lastStopReason === "end_turn"
    ? { status: "waiting", waitingReason: "reply" }
    : undefined;

const idle = (fold: Fold): Status | undefined =>
  fold.agentStarted ? { status: "idle" } : undefined;

/** First rule that matches wins; a session that has not started its agent is "starting". */
const rules = [archived, failed, setupFailed, needsPermission, running, needsReply, idle];

function statusOf(fold: Fold): Status {
  for (const rule of rules) {
    const status = rule(fold);
    if (status) return status;
  }
  return { status: "starting" };
}

const empty: Fold = {
  created: undefined,
  lastSeq: 0,
  setupExitCode: undefined,
  agentStarted: false,
  exitCode: undefined,
  turnOpen: false,
  lastStopReason: undefined,
  unansweredRequests: [],
  archivedAt: undefined,
};

function toSummary(fold: Fold, created: EventOf<"session-created">): SessionSummary {
  const { status, waitingReason } = statusOf(fold);
  const { payload } = created;
  return {
    id: created.sessionId,
    agent: payload.agent,
    status,
    ...(waitingReason ? { waitingReason } : {}),
    title: payload.title,
    repoPath: payload.repoPath,
    branch: payload.branch,
    baseBranch: payload.baseBranch,
    lastSeq: fold.lastSeq,
    createdAt: created.ts,
    ...(fold.archivedAt ? { archivedAt: fold.archivedAt } : {}),
  };
}

/**
 * The session list row for one session's events, or undefined if it has no session-created event.
 *
 * Restart rule: when the relay restarts, the agents die. Recovery appends `agent-exited` for them,
 * so a turn that was open then reads as `failed`; a session that finished its turn reads as `idle`.
 */
export function summarize(events: readonly SessionEvent[]): SessionSummary | undefined {
  const fold = events.reduce(reduce, empty);
  return fold.created ? toSummary(fold, fold.created) : undefined;
}
