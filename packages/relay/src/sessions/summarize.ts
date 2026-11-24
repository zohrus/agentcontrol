import type { SessionStatus, SessionSummary, WaitingReason } from "@agentcontrol/protocol";
import type { EventOf, Fold } from "./fold.ts";

interface Status {
  status: SessionStatus;
  waitingReason?: WaitingReason;
}

const archived = (fold: Fold): Status | undefined =>
  fold.archivedAt === undefined ? undefined : { status: "archived" };

const interrupted = (fold: Fold): Status | undefined =>
  fold.interrupted ? { status: "interrupted" } : undefined;

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

/** The agent is up and the user has not written to it yet. */
const ready = (fold: Fold): Status | undefined =>
  fold.agentStarted && fold.exitCode === undefined && fold.firstPrompt === undefined
    ? { status: "ready" }
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
const rules = [
  archived,
  interrupted,
  failed,
  setupFailed,
  needsPermission,
  ready,
  running,
  needsReply,
  idle,
];

function statusOf(fold: Fold): Status {
  for (const rule of rules) {
    const status = rule(fold);
    if (status) return status;
  }
  return { status: "starting" };
}

const turnRunning = (fold: Fold): boolean =>
  fold.turnOpen && fold.exitCode === undefined && fold.archivedAt === undefined;

const lastSegment = (path: string): string => path.split("/").filter(Boolean).at(-1) ?? path;

const firstLineOf = (text: string | undefined): string => (text?.split("\n")[0] ?? "").slice(0, 80);

/** The title the user gave, else the first prompt's first line, else "<repository> – new session". */
function titleOf(fold: Fold, created: EventOf<"session-created">): string {
  const { title, repoPath } = created.payload;
  const placeholder = `${lastSegment(repoPath)} – new session`;
  return title || firstLineOf(fold.firstPrompt) || placeholder;
}

function toSummary(fold: Fold, created: EventOf<"session-created">): SessionSummary {
  const { status, waitingReason } = statusOf(fold);
  const { payload } = created;
  return {
    id: created.sessionId,
    agent: payload.agent,
    status,
    ...(waitingReason ? { waitingReason } : {}),
    title: titleOf(fold, created),
    kind: payload.kind ?? "worktree",
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
 * Restart rule: when the relay stops or dies, its agents die. Every session whose agent was alive
 * gets an `agent-interrupted` event (see recovery.ts), which drops its pending requests (nobody is
 * left to answer them), ends the open turn and makes the session read as `interrupted` until a
 * new agent is started by resuming it. An agent that had already exited keeps its own reading
 * (`failed` when its turn was open, else `idle`).
 */
export function summaryOf(fold: Fold): SessionSummary | undefined {
  return fold.created ? toSummary(fold, fold.created) : undefined;
}
