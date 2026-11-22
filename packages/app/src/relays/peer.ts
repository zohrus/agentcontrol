import {
  type JsonRpcFailure,
  type JsonRpcMessage,
  type JsonRpcSuccess,
  linesOf,
  parseMessageLine,
} from "@agentcontrol/protocol";

/** A failure answered by the relay, with its JSON-RPC code and optional data. */
export class RelayCallError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

/** The connection ended while a call was waiting for its answer. */
export class RelayConnectionClosedError extends Error {
  constructor() {
    super("The relay connection closed.");
  }
}

export interface Notification {
  method: string;
  params: unknown;
}

interface Waiting {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

/** The request/response bookkeeping of one JSON-RPC connection. */
export class Peer {
  private nextId = 1;
  private readonly waiting = new Map<unknown, Waiting>();
  private readonly listeners: Array<(notification: Notification) => void> = [];

  constructor(private readonly send: (line: string) => void) {}

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const answered = new Promise<unknown>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
    });
    this.send(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return answered;
  }

  onNotification(listener: (notification: Notification) => void): void {
    this.listeners.push(listener);
  }

  /** Fails every call still waiting for an answer, because the connection ended. */
  failAll(): void {
    this.waiting.forEach((call) => {
      call.reject(new RelayConnectionClosedError());
    });
    this.waiting.clear();
  }

  async read(stream: ReadableStream<Uint8Array>): Promise<void> {
    for await (const line of linesOf(stream)) {
      const parsed = parseMessageLine(line);
      if (parsed.ok) this.handle(parsed.message);
    }
  }

  private handle(message: JsonRpcMessage): void {
    if (!("method" in message)) this.settle(message);
    else if (!("id" in message)) {
      this.listeners.forEach((listener) => {
        listener({ method: message.method, params: message.params });
      });
    }
  }

  private settle(message: JsonRpcSuccess | JsonRpcFailure): void {
    const call = this.waiting.get(message.id);
    this.waiting.delete(message.id);
    if (!("error" in message)) call?.resolve(message.result);
    else
      call?.reject(
        new RelayCallError(message.error.code, message.error.message, message.error.data),
      );
  }
}
