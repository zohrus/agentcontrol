import type { SessionStatus, SessionSummary, WaitingReason } from "@agentcontrol/protocol";
import type { EventOf, Fold } from "./fold.ts";

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
  fold.setupExitCode !== undefined && fold.setupExitCode !== 0
    ? { status: "waiting", waitingReason: "setup-failed" }
    : undefined;

const needsPermission = (fold: Fold): Status | undefined =>
  fold.pendingRequests.length > 0 ? { status: "waiting", waitingReason: "permission" } : undefined;

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

const turnRunning = (fold: Fold): boolean =>
  fold.turnOpen && fold.exitCode === undefined && fold.archivedAt === undefined;

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
    turnRunning: turnRunning(fold),
    pendingPermissions: fold.pendingRequests,
  };
}

/**
 * The session list row for a fold, or undefined while it has no session-created event.
 *
 * Restart rule: when the relay restarts, the agents die. Recovery appends `agent-exited` for them,
 * which also drops their pending requests (nobody is left to answer them) and ends `turnRunning`,
 * so a turn that was open then reads as `failed`; a session that finished its turn reads as `idle`.
 */
export function summaryOf(fold: Fold): SessionSummary | undefined {
  return fold.created ? toSummary(fold, fold.created) : undefined;
}
