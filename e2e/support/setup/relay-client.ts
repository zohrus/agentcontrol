import {
  type FsChangedParams,
  type JsonRpcFailure,
  type JsonRpcMessage,
  type JsonRpcSuccess,
  linesOf,
  parseMessageLine,
  RelayName,
  RelayNotifications,
  type RelayMethodName,
  type RelayParams,
  type RelayResult,
  type SessionEvent,
} from "@agentcontrol/protocol";
import type { Wire } from "./wire.ts";
import { Timeline } from "./timeline.ts";

const EVENT_WAIT_MS = 10_000;

/** A failure answered by the relay, with its JSON-RPC code. */
export class RelayCallError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export interface RelayClient {
  call<M extends RelayMethodName>(method: M, params: RelayParams<M>): Promise<RelayResult<M>>;
  /** Every `relay/event` this client has been sent, in order. */
  readonly events: Timeline<SessionEvent>;
  /** Every `relay/fs.changed` this client has been sent, in order. */
  readonly fileChanges: Timeline<FsChangedParams>;
  /** Calls any method by name, even one the relay does not have. */
  request(method: string, params: unknown): Promise<unknown>;
  /** Sends a line as it is, even one that is not JSON-RPC. */
  sendLine(line: string): void;
  /** Every error the relay sent that answers no request (it could not tell which one). */
  readonly unansweredErrors: Timeline<{ code: number; message: string }>;
  /** Closes the connection, as the app does when it quits; the relay itself keeps running. */
  disconnect(): Promise<void>;
}

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface ClientState {
  pending: Map<unknown, Pending>;
  events: Timeline<SessionEvent>;
  fileChanges: Timeline<FsChangedParams>;
  unansweredErrors: Timeline<{ code: number; message: string }>;
}

function settle(message: JsonRpcSuccess | JsonRpcFailure, pending: Map<unknown, Pending>): void {
  const waiting = pending.get(message.id);
  pending.delete(message.id);
  if ("error" in message) {
    waiting?.reject(new RelayCallError(message.error.code, message.error.message));
  } else {
    waiting?.resolve(message.result);
  }
}

function notified(message: { method: string; params?: unknown }, state: ClientState): void {
  if (message.method === RelayName.event) {
    state.events.record(RelayNotifications[RelayName.event].parse(message.params).event);
  } else if (message.method === RelayName.fsChanged) {
    state.fileChanges.record(RelayNotifications[RelayName.fsChanged].parse(message.params));
  }
}

function answered(message: JsonRpcSuccess | JsonRpcFailure, state: ClientState): void {
  if ("error" in message && message.id === null) state.unansweredErrors.record(message.error);
  else settle(message, state.pending);
}

function dispatch(message: JsonRpcMessage, state: ClientState): void {
  if ("method" in message) notified(message, state);
  else answered(message, state);
}

async function listen(
  stream: ReadableStream<Uint8Array>,
  handle: (message: JsonRpcMessage) => void,
): Promise<void> {
  for await (const line of linesOf(stream)) {
    const parsed = parseMessageLine(line);
    if (parsed.ok) handle(parsed.message);
  }
}

/** Sends a request line and resolves with the relay's answer to it. */
function requester(wire: Wire, pending: Map<unknown, Pending>) {
  let nextId = 1;
  return (method: string, params: unknown): Promise<unknown> => {
    const id = nextId++;
    const answer = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    wire.send(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return answer;
  };
}

/** Talks JSON-RPC to the relay over the wire, as the app does. */
export function connectToRelay(wire: Wire): RelayClient {
  const state: ClientState = {
    pending: new Map(),
    events: new Timeline(EVENT_WAIT_MS),
    fileChanges: new Timeline(EVENT_WAIT_MS),
    unansweredErrors: new Timeline(EVENT_WAIT_MS),
  };
  void listen(wire.output, (message) => {
    dispatch(message, state);
  });
  const request = requester(wire, state.pending);
  return {
    events: state.events,
    fileChanges: state.fileChanges,
    unansweredErrors: state.unansweredErrors,
    request,
    call: (method, params) => request(method, params) as Promise<RelayResult<typeof method>>,
    sendLine: (line) => {
      wire.send(`${line}\n`);
    },
    disconnect: async () => {
      await wire.close();
    },
  };
}
