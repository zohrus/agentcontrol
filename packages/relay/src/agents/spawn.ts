import { ndJsonStream, type Stream } from "@agentclientprotocol/sdk";

export interface SpawnedAgent {
  stream: Stream;
  exited: Promise<{ exitCode: number | null; signal?: string }>;
  /** Signals the process and everything it started (its process group); SIGTERM unless told otherwise. */
  kill: (signal?: Signal) => void;
  /** The last lines the process wrote to stderr. */
  stderrTail: () => string;
  /** True while the process, or anything it started, is still running. */
  running: () => boolean;
}

const TAIL_LINES = 10;

function drain(stderr: ReadableStream<Uint8Array>, lines: string[]): void {
  const decoder = new TextDecoder();
  void stderr.pipeTo(
    new WritableStream<Uint8Array>({
      write(chunk) {
        lines.push(...decoder.decode(chunk, { stream: true }).split("\n"));
        lines.splice(0, Math.max(0, lines.length - TAIL_LINES));
      },
    }),
  );
}

export interface SpawnOptions {
  command: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

type Signal = "SIGTERM" | "SIGKILL";

/** Signals the process and everything it started: they are one process group. */
function killGroup(child: { pid: number; kill(signal: Signal): void }, signal: Signal): void {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // The group is gone already, or could not be made: the process alone is all there is.
    child.kill(signal);
  }
}

/** Whether anything of the process group is still alive (signal 0 only asks). */
function groupRuns(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Starts the adapter in a process group of its own: it starts a CLI, which `killGroup` must reach too. */
function startProcess({ command, cwd, env }: SpawnOptions) {
  return Bun.spawn(command, {
    cwd,
    env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
}

/** Starts the adapter process and wraps its stdio as an ACP stream. */
export function spawnAgent(options: SpawnOptions): SpawnedAgent {
  const child = startProcess(options);
  const tail: string[] = [];
  drain(child.stderr, tail);
  const toAgent = new WritableStream<Uint8Array>({
    async write(chunk) {
      await child.stdin.write(chunk);
      await child.stdin.flush();
    },
  });
  const exited = child.exited.then((exitCode) => ({
    exitCode: child.signalCode ? null : exitCode,
    ...(child.signalCode ? { signal: String(child.signalCode) } : {}),
  }));
  return {
    stream: ndJsonStream(toAgent, child.stdout),
    exited,
    kill: (signal = "SIGTERM") => {
      killGroup(child, signal);
    },
    stderrTail: () => tail.filter((line) => line.trim() !== "").join("\n"),
    running: () => groupRuns(child.pid),
  };
}
