import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { openSync } from "node:fs";
import type { Socket } from "node:net";
import { join } from "node:path";
import { socketPathIn, tryConnect } from "./socket.ts";

const START_TIMEOUT_MS = 15_000;
const RETRY_MS = 50;
const mainFile = join(import.meta.dir, "../main.ts");
/** A compiled binary is its own entry point, so it takes no script path. */
const entryArgs = import.meta.dir.startsWith("/$bunfs/") ? [] : [mainFile];

function startDetachedDaemon(dataDir: string): void {
  const log = openSync(join(dataDir, "relay.log"), "a");
  const child = spawn(process.execPath, [...entryArgs, "daemon", "--data-dir", dataDir], {
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
}

async function waitForSocket(socketPath: string): Promise<Socket> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const socket = await tryConnect(socketPath);
    if (socket) return socket;
    await Bun.sleep(RETRY_MS);
  }
  throw new Error(`The relay did not start; see ${join(socketPath, "..", "relay.log")}.`);
}

async function connectStartingIfNeeded(dataDir: string): Promise<Socket> {
  await mkdir(dataDir, { recursive: true });
  const socketPath = socketPathIn(dataDir);
  const running = await tryConnect(socketPath);
  if (running) return running;
  startDetachedDaemon(dataDir);
  return waitForSocket(socketPath);
}

/** Pipes stdin/stdout to the daemon (starting it if needed) and exits when stdin closes. */
export async function runBridge(dataDir: string): Promise<void> {
  const socket = await connectStartingIfNeeded(dataDir);
  process.stdin.pipe(socket);
  socket.pipe(process.stdout);
  socket.on("close", () => {
    process.exit(0);
  });
}
