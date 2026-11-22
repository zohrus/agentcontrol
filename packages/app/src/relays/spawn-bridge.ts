import type { RelayTransport } from "./connect.ts";

/** The production transport: spawns the relay bridge (`<command> --stdio --data-dir <dir>`). */
export function spawnRelayBridge(options: {
  command: string[];
  dataDir: string;
  /** Extra environment for the bridge, and the daemon it starts; the process environment otherwise. */
  env?: Record<string, string>;
}): RelayTransport {
  const bridge = Bun.spawn([...options.command, "--stdio", "--data-dir", options.dataDir], {
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
