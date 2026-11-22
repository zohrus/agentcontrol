import { connect, type Socket } from "node:net";

/** A line-based channel to a relay, the way the app has one. */
export interface Wire {
  /** Writes one newline-terminated JSON-RPC line. */
  send(line: string): void;
  readonly output: ReadableStream<Uint8Array>;
  readonly closed: Promise<unknown>;
  /** Ends the channel; the relay daemon keeps running. */
  close(): Promise<void>;
}

/** The socket's bytes as a stream that simply ends when the socket does, even by an error. */
function streamOf(socket: Socket): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      socket.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      socket.once("close", () => {
        controller.close();
      });
    },
  });
}

/** Connects straight to the relay daemon's unix socket: what the bridge does, minus the process. */
export function socketWire(socketPath: string): Wire {
  const socket = connect(socketPath);
  const closed = new Promise<void>((resolve) => {
    socket.once("close", () => {
      resolve();
    });
  });
  socket.on("error", () => undefined);
  return {
    output: streamOf(socket),
    closed,
    send: (line) => {
      socket.write(line);
    },
    close: async () => {
      socket.end();
      await closed;
    },
  };
}

/** Spawns the real relay bridge (`main.ts --stdio`), which starts the daemon if none is running. */
export function bridgeWire(options: {
  relayMain: string;
  dataDir: string;
  env: Record<string, string>;
}): Wire {
  const bridge = Bun.spawn(["bun", options.relayMain, "--stdio", "--data-dir", options.dataDir], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
    env: { ...Bun.env, ...options.env },
  });
  return {
    output: bridge.stdout,
    closed: bridge.exited,
    send: (line) => {
      void bridge.stdin.write(line);
      void bridge.stdin.flush();
    },
    close: async () => {
      void bridge.stdin.end();
      await bridge.exited;
    },
  };
}
