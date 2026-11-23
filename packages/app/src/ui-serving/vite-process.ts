import { readFile, writeFile } from "node:fs/promises";
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

/** Which UI to serve, and the file that records the process that serves it. */
export interface Where {
  root: string;
  pidFile: string;
}

function portIn(line: string): number | undefined {
  try {
    return PortLine.safeParse(JSON.parse(line)).data?.port;
  } catch {
    return undefined;
  }
}

/** The port named by the first line that names one, with the text before and after that line. */
function findPort(text: string): { port: number; before: string; after: string } | undefined {
  const lines = text.split("\n");
  for (const [at, line] of lines.slice(0, -1).entries()) {
    const port = portIn(line);
    if (port === undefined) continue;
    return { port, before: lines.slice(0, at).join("\n"), after: lines.slice(at + 1).join("\n") };
  }
  return undefined;
}

/**
 * The server prints one line, `{"port":N}`, when it listens. What it prints before that (Vite may
 * log while it starts) and after it is the server's log, which goes to this process's stderr.
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
    forwardLog(child, [found.before, found.after].filter((part) => part !== "").join("\n"));
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
 * `bun` (BUN_BE_BUN), so no other runtime has to be installed.
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

/** Whether this process id is a UI server (a reused id of an unrelated program is left alone). */
function isUiServer(pid: number): boolean {
  const run = Bun.spawnSync(["ps", "-o", "command=", "-p", String(pid)]);
  return run.stdout.toString().includes("server.ts");
}

/**
 * Stops the UI server that a previous run of the app left behind. `bun --watch` replaces the
 * running app in place, and a killed app cannot stop its child, so the child outlives the app.
 */
async function stopLeftover(pidFile: string): Promise<void> {
  const pid = Number(await readFile(pidFile, "utf8").catch(() => ""));
  if (!Number.isInteger(pid) || pid <= 0 || !isUiServer(pid)) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // It ended by itself in the meantime, or belongs to someone else: nothing left to stop.
  }
}

/** Starts the UI server for the project in `where.root` and waits until it says where it listens. */
export async function launch(where: Where): Promise<Running> {
  await stopLeftover(where.pidFile);
  const child = startDevServer(where.root);
  let timer: Timer | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("The UI server did not start in time."));
    }, START_TIMEOUT_MS);
  });
  try {
    await writeFile(where.pidFile, String(child.pid));
    return { child, port: await Promise.race([readPort(child), late]) };
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
