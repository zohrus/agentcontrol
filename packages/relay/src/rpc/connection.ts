import {
  ErrorCode,
  type JsonRpcId,
  parseMessageLine,
  type RelayMethodName,
  RelayMethods,
  type RelayParams,
} from "@agentcontrol/protocol";
import { RelayError, toErrorBody } from "./errors.ts";
import type { Client, Handler, Handlers } from "./types.ts";

export interface RpcConnection {
  /** Handles one line received from the client. */
  receive(line: string): void;
  /** Tells the connection its client is gone, so subscriptions can stop. */
  close(): void;
}

function isRelayMethod(name: string): name is RelayMethodName {
  return Object.hasOwn(RelayMethods, name);
}

async function run<M extends RelayMethodName>(call: {
  name: M;
  handlers: Handlers;
  raw: unknown;
  client: Client;
}) {
  const checked = RelayMethods[call.name].params.safeParse(call.raw ?? {});
  if (!checked.success) throw new RelayError(ErrorCode.invalidParams, checked.error.message);
  const handler = call.handlers[call.name] as Handler<M>;
  return handler(checked.data as RelayParams<M>, call.client);
}

type Write = (message: object) => void;

async function answer(
  call: { id: JsonRpcId; method: string; raw: unknown },
  context: { handlers: Handlers; client: Client; write: Write },
): Promise<void> {
  const { id, method } = call;
  try {
    if (!isRelayMethod(method)) {
      throw new RelayError(ErrorCode.methodNotFound, `Unknown method "${method}".`);
    }
    const result = await run({ name: method, raw: call.raw, ...context });
    context.write({ id, result });
  } catch (error) {
    context.write({ id, error: toErrorBody(error) });
  }
}

function rejectLine(parsed: { reason: string; detail: string }, write: Write): void {
  const code = parsed.reason === "invalid-json" ? ErrorCode.parseError : ErrorCode.invalidRequest;
  write({ id: null, error: toErrorBody(new RelayError(code, parsed.detail)) });
}

function clientFor(write: Write): { client: Client; cleanups: Array<() => void> } {
  const cleanups: Array<() => void> = [];
  const client: Client = {
    notify: (method, params) => {
      write({ method, params });
    },
    onClose: (cleanup) => cleanups.push(cleanup),
  };
  return { client, cleanups };
}

/** One client's JSON-RPC session: parse, validate, dispatch to the handler table, answer. */
export function createRpcConnection(options: {
  handlers: Handlers;
  send: (line: string) => void;
}): RpcConnection {
  const write: Write = (message) => {
    options.send(JSON.stringify({ jsonrpc: "2.0", ...message }));
  };
  const { client, cleanups } = clientFor(write);
  const context = { handlers: options.handlers, client, write };
  return {
    receive: (line) => {
      const parsed = parseMessageLine(line);
      if (!parsed.ok) rejectLine(parsed, write);
      else if ("method" in parsed.message && "id" in parsed.message) {
        const { id, method, params } = parsed.message;
        void answer({ id, method, raw: params }, context);
      }
    },
    close: () => {
      cleanups.splice(0).forEach((cleanup) => {
        cleanup();
      });
    },
  };
}
