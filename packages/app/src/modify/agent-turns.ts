import {
  type AgentKind,
  RelayName as N,
  type RelayMethodName,
  type RelayParams,
  type RelayResult,
  type SessionEvent,
  type SessionId,
} from "@agentcontrol/protocol";

/** The part of the relay connection the Modify agent needs. */
export interface RelayCalls {
  call<M extends RelayMethodName>(method: M, params: RelayParams<M>): Promise<RelayResult<M>>;
  refreshSessions(): Promise<void>;
}

/** Where the app keeps session events, and how it hears about new ones. */
export interface SessionEvents {
  after(query: { sessionId: SessionId; afterSeq: number }): SessionEvent[];
  /** Calls the listener for every new session event; returns how to stop. */
  onEvent(listener: (event: SessionEvent) => void): () => void;
}

const DISCARDED: TurnOutcome = { ok: false, reason: "The change was discarded." };

type TurnOutcome = { ok: true } | { ok: false; reason: string };

interface TurnRequest {
  text: string;
  firstPrompt: string;
  title: string;
}

/** One Modify agent session at a time: start it, send it prompts, wait for each turn to end. */
export interface AgentTurns {
  /**
   * Continues the current session with `text`, or starts one with `firstPrompt`. When `wanted`
   * says no (the change was discarded meanwhile), no session is started or it is ended again.
   */
  run(options: TurnRequest & { wanted: () => boolean }): Promise<TurnOutcome>;
  /** The current (or last) session. */
  sessionId(): SessionId | undefined;
  /** Cancels the running turn and archives the session. */
  end(): Promise<void>;
}

interface Deps {
  relay: RelayCalls;
  events: SessionEvents;
  /** The folder the agent works in, and the only one it may edit. */
  folder: string;
  agent: AgentKind;
  /** Called when a session has been created, so the UI can show its chat at once. */
  onSession: () => void;
}

function outcomeOf(event: SessionEvent): TurnOutcome | undefined {
  if (event.kind === "agent-exited" || event.kind === "agent-interrupted") {
    return { ok: false, reason: "The Modify agent stopped before it finished." };
  }
  if (event.kind !== "turn-ended") return undefined;
  const { stopReason } = event.payload;
  return stopReason === "end_turn"
    ? { ok: true }
    : { ok: false, reason: `The Modify agent stopped early (${stopReason}).` };
}

function lastSeqOf(events: SessionEvents, sessionId: SessionId): number {
  return events.after({ sessionId, afterSeq: 0 }).at(-1)?.seq ?? 0;
}

/** Resolves when the session's turn ends, or its agent dies; looks only at events after `fromSeq`. */
function turnEnd(options: { events: SessionEvents; sessionId: SessionId; fromSeq: number }): {
  done: Promise<TurnOutcome>;
  look: () => void;
} {
  const { events, sessionId } = options;
  let cursor = options.fromSeq;
  let finish: (outcome: TurnOutcome) => void = () => undefined;
  const done = new Promise<TurnOutcome>((resolve) => {
    finish = resolve;
  });
  const look = (): void => {
    const fresh = events.after({ sessionId, afterSeq: cursor });
    cursor = fresh.at(-1)?.seq ?? cursor;
    const outcome = fresh.map(outcomeOf).find((found) => found !== undefined);
    if (outcome) finish(outcome);
  };
  return { done, look };
}

/** Starts listening for the end of a turn; `stop` must be called when the caller is done. */
function listenForTurn(options: { events: SessionEvents; sessionId: SessionId; fromSeq: number }) {
  const { done, look } = turnEnd(options);
  const unsubscribe = options.events.onEvent((event) => {
    if (event.sessionId === options.sessionId) look();
  });
  look();
  return { done, stop: unsubscribe };
}

/** The open session, if any. */
interface Current {
  id?: SessionId;
  /** The session that ended last, so its chat can still be read. */
  last?: SessionId;
  open: boolean;
}

async function begin(options: { deps: Deps; current: Current; prompt: string; title: string }) {
  const { deps, current } = options;
  const created = await deps.relay.call(N.sessionsCreate, {
    kind: "directory",
    agent: deps.agent,
    cwd: deps.folder,
    prompt: options.prompt,
    title: options.title,
    permissionPolicy: { allowEditsUnder: deps.folder },
  });
  current.id = created.sessionId;
  current.open = true;
  const turn = listenForTurn({ events: deps.events, sessionId: created.sessionId, fromSeq: 0 });
  await deps.relay.refreshSessions().catch((error: unknown) => {
    turn.stop();
    throw error;
  });
  deps.onSession();
  return turn.done.finally(turn.stop);
}

async function carryOn(options: { deps: Deps; sessionId: SessionId; text: string }) {
  const { deps, sessionId } = options;
  const fromSeq = lastSeqOf(deps.events, sessionId);
  const turn = listenForTurn({ events: deps.events, sessionId, fromSeq });
  try {
    await deps.relay.call(N.prompt, { sessionId, text: options.text });
  } catch (error) {
    turn.stop();
    throw error;
  }
  return turn.done.finally(turn.stop);
}

type WantedTurn = TurnRequest & { wanted: () => boolean };

/** Starts a session for the request, unless the change was discarded before or while it started. */
async function beginIfWanted(deps: Deps, current: Current, request: WantedTurn) {
  if (!request.wanted()) return DISCARDED;
  const outcome = await begin({ deps, current, prompt: request.firstPrompt, title: request.title });
  if (request.wanted()) return outcome;
  await endSession(deps, current);
  return DISCARDED;
}

/** Continues the open session; when there is none (or its agent is gone) starts a new one. */
async function turnOf(deps: Deps, current: Current, request: WantedTurn): Promise<TurnOutcome> {
  if (current.id && current.open) {
    const carried = await carryOn({ deps, sessionId: current.id, text: request.text }).catch(
      () => undefined,
    );
    if (carried) return carried;
    await endSession(deps, current);
  }
  return beginIfWanted(deps, current, request);
}

async function endSession(deps: Deps, current: Current): Promise<void> {
  const sessionId = current.id;
  current.open = false;
  delete current.id;
  if (!sessionId) return;
  current.last = sessionId;
  await deps.relay.call(N.cancel, { sessionId }).catch(() => undefined);
  await deps.relay.call(N.sessionsArchive, { sessionId, force: true }).catch(() => undefined);
}

export function createAgentTurns(deps: Deps): AgentTurns {
  const current: Current = { open: false };
  return {
    sessionId: () => current.id ?? current.last,
    run: (request) =>
      turnOf(deps, current, request).catch((error: unknown) => ({
        ok: false as const,
        reason: error instanceof Error ? error.message : String(error),
      })),
    end: () => endSession(deps, current),
  };
}
