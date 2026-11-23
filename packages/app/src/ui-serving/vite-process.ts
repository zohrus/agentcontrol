import { join } from "node:path";
import { z } from "zod";
import { findResources } from "../resources/index.ts";

const START_TIMEOUT_MS = 60_000;
const PortLine = z.object({ port: z.number() });

type DevServer = Bun.Subprocess<"ignore", "pipe", "inherit">;

/** A UI server process and the port it listens on. */
export interface Running {
  child: DevServer;
  port: number;
}

function portIn(line: string): number | undefined {
  try {
    return PortLine.safeParse(JSON.parse(line)).data?.port;
  } catch {
    return undefined;
  }
}

/** The port named by the first line that names one, with the text after that line. */
function findPort(text: string): { port: number; rest: string } | undefined {
  const lines = text.split("\n");
  for (const [at, line] of lines.slice(0, -1).entries()) {
    const port = portIn(line);
    if (port !== undefined) return { port, rest: lines.slice(at + 1).join("\n") };
  }
  return undefined;
}

/**
 * The server prints one line, `{"port":N}`, when it listens. Lines before it (Vite may log while
 * it starts) and everything after it is the server's log, which goes to this process's stderr.
 */
async function readPort(child: DevServer): Promise<number> {
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let seen = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`The UI server stopped before it was ready: ${seen}`);
    seen += decoder.decode(chunk.value, { stream: true });
    const found = findPort(seen);
    if (found === undefined) continue;
    reader.releaseLock();
    forwardLog(child, found.rest);
    return found.port;
  }
}

/** What the server prints from now on goes to this process's stderr, after what was read already. */
function forwardLog(child: DevServer, alreadyRead: string): void {
  process.stderr.write(alreadyRead);
  void child.stdout.pipeTo(new WritableStream({ write: (log) => void process.stderr.write(log) }));
}

/**
 * Runs the UI template's `server.ts` (Vite) as a child process: the app binary is started as
 * `bun` (BUN_BE_BUN), so no other runtime has to be installed. It quits when the app does.
 */
function startDevServer(root: string): DevServer {
  const script = join(
    findResources({ env: process.env, execPath: process.execPath }).templateDir,
    "server.ts",
  );
  return Bun.spawn([process.execPath, script, root], {
    cwd: root,
    env: { ...process.env, BUN_BE_BUN: "1" },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
}

/** Starts the UI server for the project in `root` and waits until it says where it listens. */
export async function launch(root: string): Promise<Running> {
  const child = startDevServer(root);
  let timer: Timer | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("The UI server did not start in time."));
    }, START_TIMEOUT_MS);
  });
  try {
    return { child, port: await Promise.race([readPort(child), late]) };
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
