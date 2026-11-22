import { readFile } from "node:fs/promises";
import { runBridge } from "./bridge.ts";
import { pidFileIn, startDaemon } from "./server.ts";

export { runBridge };

/** Runs the daemon in this process until it is told to stop (SIGTERM or SIGINT). */
export async function runDaemon(dataDir: string): Promise<void> {
  const daemon = await startDaemon({ dataDir });
  const shutDown = (): void => {
    void daemon.stop().then(() => {
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutDown);
  process.on("SIGINT", shutDown);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Tells a running daemon to stop and waits until it is gone; does nothing if none is running. */
export async function stopDaemon(dataDir: string): Promise<void> {
  const text = await readFile(pidFileIn(dataDir), "utf8").catch(() => undefined);
  const pid = Number(text);
  if (!pid || !isAlive(pid)) return;
  process.kill(pid, "SIGTERM");
  while (isAlive(pid)) await Bun.sleep(20);
}
