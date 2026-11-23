import type { RelayTransport } from "./connect.ts";

const KILL_AFTER_MS = 3000;

export interface BridgeOptions {
  /** The whole command line: the relay bridge with its `--stdio` and `--data-dir` flags. */
  argv: string[];
  /** Extra environment for the process; the app's own environment otherwise. */
  env?: Record<string, string> | undefined;
  /**
   * Keep what the process writes on stderr (for `failure`) instead of passing it on to the app's
   * own stderr. `explain` turns it into the plain-language reason a connection failed.
   */
  capture?: { explain: (stderr: string) => string | undefined } | undefined;
}

/** Collects the tail of stderr; `done` resolves when the stream ends. */
function collect(stream: ReadableStream<Uint8Array>): { text: () => string; done: Promise<void> } {
  let text = "";
  const decoder = new TextDecoder();
  const done = stream
    .pipeTo(
      new WritableStream<Uint8Array>({
        write(chunk) {
          text = (text + decoder.decode(chunk, { stream: true })).slice(-4000);
        },
      }),
    )
    .catch(() => undefined);
  return { text: () => text, done };
}

/** Spawns a relay bridge as given; used for the local relay and, through ssh, for remote ones. */
export function spawnBridge(options: BridgeOptions): RelayTransport {
  const { capture } = options;
  const bridge = Bun.spawn(options.argv, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: capture ? "pipe" : "inherit",
    env: { ...Bun.env, ...options.env },
  });
  const errors = capture ? collect(bridge.stderr as ReadableStream<Uint8Array>) : undefined;
  return {
    output: bridge.stdout,
    closed: Promise.all([bridge.exited, errors?.done]),
    failure: () => (capture && errors ? capture.explain(errors.text()) : undefined),
    send: (line) => {
      // The bridge may already have exited: `closed` says so, a failed write needs no other answer.
      void Promise.try(async () => {
        void bridge.stdin.write(line);
        await bridge.stdin.flush();
      }).catch(() => undefined);
    },
    close: () => endBridge(bridge),
  };
}

/** Ends the bridge's input and waits for it; a dead network can leave ssh waiting, so it is killed after a while. */
async function endBridge(
  bridge: Bun.Subprocess<"pipe", "pipe", "pipe" | "inherit">,
): Promise<void> {
  await Promise.try(() => bridge.stdin.end()).catch(() => undefined);
  const timer = setTimeout(() => {
    bridge.kill();
  }, KILL_AFTER_MS);
  await bridge.exited;
  clearTimeout(timer);
}

/** The local relay bridge (`<command> --stdio --data-dir <dir>`). */
export function spawnRelayBridge(options: {
  command: string[];
  dataDir: string;
  /** Extra environment for the bridge, and the daemon it starts; the process environment otherwise. */
  env?: Record<string, string>;
}): RelayTransport {
  const argv = [...options.command, "--stdio", "--data-dir", options.dataDir];
  return spawnBridge({ argv, env: options.env });
}
