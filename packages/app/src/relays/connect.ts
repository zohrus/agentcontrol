import {
  type RelayMethodName,
  RelayMethods,
  type RelayParams,
  type RelayResult,
} from "@agentcontrol/protocol";
import { type Notification, Peer } from "./peer.ts";

/** A line-based channel to a relay: how the bytes travel is the transport's business. */
export interface RelayTransport {
  /** Writes one newline-terminated JSON-RPC line. */
  send(line: string): void;
  /** What the relay sends back. */
  readonly output: ReadableStream<Uint8Array>;
  /** Resolves when the channel ends, for any reason. */
  readonly closed: Promise<unknown>;
  /** Ends the channel; the relay daemon itself keeps running. */
  close(): Promise<void>;
  /** Why the channel could not be used, in plain words, when the process behind it said so. */
  failure?: () => string | undefined;
}

/** A live connection to a relay: typed calls, pushed notifications, and when it ends. */
export interface RelayClient {
  call<M extends RelayMethodName>(method: M, params: RelayParams<M>): Promise<RelayResult<M>>;
  onNotification(listener: (notification: Notification) => void): void;
  /** Resolves when the connection ends, for any reason. Reconnecting is the caller's job. */
  readonly closed: Promise<void>;
  /** Closes the connection; the relay daemon itself keeps running. */
  close(): Promise<void>;
  /** Why the connection failed, in plain words, when the channel knows (an ssh error, say). */
  failure(): string | undefined;
}

/** Talks JSON-RPC to a relay over the given transport. */
export function relayClientOver(transport: RelayTransport): RelayClient {
  const peer = new Peer((line) => {
    transport.send(line);
  });
  void peer.read(transport.output);
  const closed = transport.closed.then(() => {
    peer.failAll();
  });
  return {
    closed,
    failure: () => transport.failure?.(),
    onNotification: (listener) => {
      peer.onNotification(listener);
    },
    call: async (method, params) =>
      RelayMethods[method].result.parse(await peer.request(method, params)) as RelayResult<
        typeof method
      >,
    close: async () => {
      await transport.close();
      await closed;
    },
  };
}
