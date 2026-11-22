import { join } from "node:path";
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
import { Timeline } from "./timeline.ts";

const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");
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

function dispatch(message: JsonRpcMessage, state: ClientState): void {
  if (!("method" in message)) settle(message, state.pending);
  else if (message.method === RelayName.event) {
    state.events.record(RelayNotifications[RelayName.event].parse(message.params).event);
  } else if (message.method === RelayName.fsChanged) {
    state.fileChanges.record(RelayNotifications[RelayName.fsChanged].parse(message.params));
  }
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

function spawnBridge(options: { dataDir: string; env: Record<string, string> }) {
  return Bun.spawn(["bun", relayMain, "--stdio", "--data-dir", options.dataDir], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
    env: { ...Bun.env, ...options.env },
  });
}

/** Starts the relay bridge exactly as the app does (`main.ts --stdio`) and talks JSON-RPC over it. */
export function connectToRelay(options: {
  dataDir: string;
  env: Record<string, string>;
}): RelayClient {
  const bridge = spawnBridge(options);
  const state: ClientState = {
    pending: new Map(),
    events: new Timeline(EVENT_WAIT_MS),
    fileChanges: new Timeline(EVENT_WAIT_MS),
  };
  void listen(bridge.stdout, (message) => {
    dispatch(message, state);
  });
  let nextId = 1;
  return {
    events: state.events,
    fileChanges: state.fileChanges,
    call: (method, params) => {
      const id = nextId++;
      const answered = new Promise((resolve, reject) => state.pending.set(id, { resolve, reject }));
      void bridge.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      void bridge.stdin.flush();
      return answered as Promise<RelayResult<typeof method>>;
    },
    disconnect: async () => {
      void bridge.stdin.end();
      await bridge.exited;
    },
  };
}

/** Tells the relay daemon of this data folder to shut down, and waits until it has. */
export async function stopRelayDaemon(dataDir: string): Promise<void> {
  const stop = Bun.spawn(["bun", relayMain, "stop", "--data-dir", dataDir], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await stop.exited;
}
