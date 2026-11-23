import type { EventKind, PendingPermissionRequest, SessionEvent } from "@agentcontrol/protocol";
import { pendingRequestOf } from "./pending-request.ts";

export type EventOf<K extends EventKind> = Extract<SessionEvent, { kind: K }>;

/** Everything a session summary needs, built up by applying the session's events in order. */
export interface Fold {
  created: EventOf<"session-created"> | undefined;
  lastSeq: number;
  setupExitCode: number | undefined;
  agentStarted: boolean;
  /** The relay stopped while the agent ran; cleared when a new agent is started. */
  interrupted: boolean;
  exitCode: number | null | undefined;
  turnOpen: boolean;
  lastStopReason: string | undefined;
  pendingRequests: PendingPermissionRequest[];
  archivedAt: string | undefined;
}

type Reducers = { [K in EventKind]: (fold: Fold, event: EventOf<K>) => Fold };

/** One small reducer per event kind. */
const reducers: Reducers = {
  acp: (fold) => fold,
  "setup-output": (fold) => fold,
  "session-created": (fold, event) => ({ ...fold, created: event }),
  "setup-finished": (fold, event) => ({ ...fold, setupExitCode: event.payload.exitCode }),
  // A started agent is a living one, also after an earlier agent of the session was interrupted.
  "agent-started": (fold) => ({
    ...fold,
    agentStarted: true,
    interrupted: false,
    exitCode: undefined,
  }),
  "agent-exited": (fold, event) => ({
    ...fold,
    exitCode: event.payload.exitCode,
    pendingRequests: [],
  }),
  // The turn the agent was in the middle of is over: nobody is left to finish it.
  "agent-interrupted": (fold) => ({
    ...fold,
    interrupted: true,
    pendingRequests: [],
    turnOpen: false,
    lastStopReason: "interrupted",
  }),
  "session-resumed": (fold) => fold,
  "permission-requested": (fold, event) => ({
    ...fold,
    pendingRequests: [...fold.pendingRequests, pendingRequestOf(event.payload)],
  }),
  "permission-answered": (fold, event) => ({
    ...fold,
    pendingRequests: fold.pendingRequests.filter((r) => r.requestId !== event.payload.requestId),
  }),
  "prompt-sent": (fold) => ({ ...fold, turnOpen: true, lastStopReason: undefined }),
  "turn-ended": (fold, event) => ({
    ...fold,
    turnOpen: false,
    lastStopReason: event.payload.stopReason,
  }),
  "session-archived": (fold, event) => ({ ...fold, archivedAt: event.ts }),
};

export const emptyFold: Fold = {
  created: undefined,
  lastSeq: 0,
  setupExitCode: undefined,
  agentStarted: false,
  interrupted: false,
  exitCode: undefined,
  turnOpen: false,
  lastStopReason: undefined,
  pendingRequests: [],
  archivedAt: undefined,
};

/** The fold after one more event. An event at or before `lastSeq` was already applied: ignored. */
export function applyEvent(fold: Fold, event: SessionEvent): Fold {
  if (event.seq <= fold.lastSeq) return fold;
  const reducer = reducers[event.kind] as (fold: Fold, event: SessionEvent) => Fold;
  return { ...reducer(fold, event), lastSeq: event.seq };
}
