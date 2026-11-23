import { rm } from "node:fs/promises";
import { connect } from "node:net";
import { join } from "node:path";

/** One running code-server, listening on a unix socket only the relay's user can open. */
export interface CodeServer {
  readonly socketPath: string;
  /** Ends it and everything it started (its process group); resolves once they are gone. */
  stop(): Promise<void>;
  /** Resolves when the process has ended, however it ended. */
  readonly exited: Promise<void>;
}

export interface CodeServerSpec {
  /** The program and its leading arguments (see `codeServerCommand`). */
  command: string[];
  env: Record<string, string>;
  /** The folder it opens: the session's worktree. */
  folder: string;
  socketPath: string;
  /** Where its settings and extensions live: one per workspace, so extensions persist. */
  stateDir: string;
}

const START_TIMEOUT_MS = 60_000;
const POLL_MS = 50;
const TERM_GRACE_MS = 3000;
const STDERR_KEPT = 2000;

/**
 * The arguments that matter for safety. `--socket` with mode 600 and no `--bind-addr` means no TCP
 * port is opened at all; `--auth none` is acceptable only because of that and because the socket
 * sits in a folder (mode 700) of the relay's own data folder, reachable by this user alone.
 */
function codeServerArgs(spec: CodeServerSpec): string[] {
  const { stateDir } = spec;
  return [
    ...["--socket", spec.socketPath, "--socket-mode", "600", "--auth", "none"],
    ...["--disable-telemetry", "--disable-update-check"],
    ...["--user-data-dir", join(stateDir, "user-data")],
    ...["--extensions-dir", join(stateDir, "extensions")],
    ...["--config", join(stateDir, "config.yaml")],
    spec.folder,
  ];
}

function canConnect(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(socketPath);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

/** Keeps the last bytes of the stream (read continuously, so the process never blocks on a full pipe). */
function tailOf(stream: ReadableStream<Uint8Array>): () => string {
  let kept = "";
  const decoder = new TextDecoder();
  void (async () => {
    for await (const chunk of stream) kept = (kept + decoder.decode(chunk)).slice(-STDERR_KEPT);
  })().catch(() => undefined);
  return () => kept.trim();
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone: nothing left to signal.
  }
}

async function stopProcess(child: Bun.Subprocess): Promise<void> {
  // A process that already ended may have left its id to another program.
  if (child.exitCode !== null || child.signalCode !== null) return;
  signalGroup(child.pid, "SIGTERM");
  const timer = setTimeout(() => {
    signalGroup(child.pid, "SIGKILL");
  }, TERM_GRACE_MS);
  await child.exited;
  clearTimeout(timer);
  // Extension hosts and terminals it started may ignore the hangup: the group is still there.
  signalGroup(child.pid, "SIGKILL");
}

/** Resolves when the socket accepts connections; throws if the process ends first or it takes too long. */
async function untilListening(call: {
  child: Bun.Subprocess;
  socketPath: string;
  stderr: () => string;
}): Promise<void> {
  const { child, socketPath, stderr } = call;
  const giveUpAt = Date.now() + START_TIMEOUT_MS;
  while (!(await canConnect(socketPath))) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`code-server stopped at start (${String(child.exitCode)}): ${stderr()}`);
    }
    if (Date.now() > giveUpAt) throw new Error(`code-server did not start in time: ${stderr()}`);
    await Bun.sleep(POLL_MS);
  }
}

/** Starts code-server for the folder and waits until it listens; it is stopped again if it never does. */
export async function startCodeServer(spec: CodeServerSpec): Promise<CodeServer> {
  const { socketPath } = spec;
  await rm(socketPath, { force: true });
  const child = Bun.spawn([...spec.command, ...codeServerArgs(spec)], {
    cwd: spec.folder,
    env: spec.env,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
    // Its own process group, so stopping it reaches the extension host and terminals it starts.
    detached: true,
  });
  const stderr = tailOf(child.stderr);
  const server: CodeServer = {
    socketPath,
    stop: async () => {
      await stopProcess(child);
      await rm(socketPath, { force: true });
    },
    exited: child.exited.then(() => undefined),
  };
  await untilListening({ child, socketPath, stderr }).catch(async (error: unknown) => {
    await server.stop();
    throw error;
  });
  return server;
}
