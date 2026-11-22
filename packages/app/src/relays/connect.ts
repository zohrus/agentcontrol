import {
  type RelayMethodName,
  RelayMethods,
  type RelayParams,
  type RelayResult,
} from "@agentcontrol/protocol";
import { type Notification, Peer } from "./peer.ts";

export interface RelayConnection {
  command: string[];
  dataDir: string;
}

/** A live connection to a relay: typed calls, pushed notifications, and when it ends. */
export interface RelayClient {
  call<M extends RelayMethodName>(method: M, params: RelayParams<M>): Promise<RelayResult<M>>;
  onNotification(listener: (notification: Notification) => void): void;
  /** Resolves when the connection ends, for any reason. Reconnecting is the caller's job. */
  readonly closed: Promise<void>;
  /** Closes the connection; the relay daemon itself keeps running. */
  close(): Promise<void>;
}

/** Spawns the relay bridge (`<command> --stdio --data-dir <dir>`) and talks JSON-RPC over it. */
export function connectRelay({ command, dataDir }: RelayConnection): RelayClient {
  const bridge = Bun.spawn([...command, "--stdio", "--data-dir", dataDir], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  const peer = new Peer((line) => {
    void bridge.stdin.write(line);
    void bridge.stdin.flush();
  });
  void peer.read(bridge.stdout);
  const closed = bridge.exited.then(() => {
    peer.failAll("the relay connection closed");
  });
  return {
    closed,
    onNotification: (listener) => {
      peer.onNotification(listener);
    },
    call: async (method, params) =>
      RelayMethods[method].result.parse(await peer.request(method, params)) as RelayResult<
        typeof method
      >,
    close: async () => {
      void bridge.stdin.end();
      await closed;
    },
  };
}
