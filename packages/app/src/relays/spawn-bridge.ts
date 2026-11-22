import type { RelayTransport } from "./connect.ts";

/** The production transport: spawns the relay bridge (`<command> --stdio --data-dir <dir>`). */
export function spawnRelayBridge(options: { command: string[]; dataDir: string }): RelayTransport {
  const bridge = Bun.spawn([...options.command, "--stdio", "--data-dir", options.dataDir], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
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
