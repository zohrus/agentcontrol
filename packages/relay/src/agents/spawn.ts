import { ndJsonStream, type Stream } from "@agentclientprotocol/sdk";

export interface SpawnedAgent {
  stream: Stream;
  exited: Promise<{ exitCode: number | null; signal?: string }>;
  kill: () => void;
  /** The last lines the process wrote to stderr. */
  stderrTail: () => string;
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

/** Starts the adapter process and wraps its stdio as an ACP stream. */
export function spawnAgent({ command, cwd, env }: SpawnOptions): SpawnedAgent {
  const child = Bun.spawn(command, {
    cwd,
    env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
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
    kill: () => {
      child.kill();
    },
    stderrTail: () => tail.filter((line) => line.trim() !== "").join("\n"),
  };
}
