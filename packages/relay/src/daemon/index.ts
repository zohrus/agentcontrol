import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isAlive } from "./alive.ts";
import { runBridge } from "./bridge.ts";
import { pidFileIn, startDaemon } from "./server.ts";

export { runBridge };
export type { Daemon, DaemonOptions } from "./server.ts";
export { startDaemon } from "./server.ts";

/** Runs the daemon in this process until it is told to stop (SIGTERM or SIGINT). */
export async function runDaemon(dataDir: string): Promise<void> {
  const daemon = await startDaemon({ dataDir });
  // However the stop ends, the process must end: a daemon that failed to stop would keep running.
  const shutDown = (): void => {
    void daemon
      .stop()
      .then(() => 0)
      .catch((error: unknown) => {
        console.error(`The relay did not stop cleanly: ${String(error)}`);
        return 1;
      })
      .then((code) => {
        process.exit(code);
      });
  };
  process.on("SIGTERM", shutDown);
  process.on("SIGINT", shutDown);
}

/** How long `stop` waits for the daemon to be gone before it reports that it could not stop it. */
const STOP_WAIT_MS = 5000;

async function waitUntilGone(pid: number): Promise<boolean> {
  const deadline = Date.now() + STOP_WAIT_MS;
  while (isAlive(pid) && Date.now() < deadline) await Bun.sleep(20);
  return !isAlive(pid);
}

function signalStop(pid: number): string | undefined {
  try {
    process.kill(pid, "SIGTERM");
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

interface Outcome {
  ok: boolean;
  message: string;
}

/** The process id to stop, or the outcome that says why there is none (nothing running is not a failure). */
function targetOf(text: string | undefined, folder: string): number | Outcome {
  if (text === undefined) {
    return { ok: true, message: `No relay is running for ${folder}: it has no relay.pid.` };
  }
  const pid = Number(text);
  if (!Number.isInteger(pid) || pid <= 0) {
    const message = `Could not stop the relay for ${folder}: relay.pid does not hold a process id.`;
    return { ok: false, message };
  }
  const gone = `No relay is running for ${folder}: process ${String(pid)} is gone.`;
  return isAlive(pid) ? pid : { ok: true, message: gone };
}

async function stopProcess(pid: number, folder: string): Promise<Outcome> {
  const refused = signalStop(pid);
  if (refused !== undefined) {
    return { ok: false, message: `Could not stop the relay (process ${String(pid)}): ${refused}` };
  }
  if (await waitUntilGone(pid)) {
    return { ok: true, message: `Stopped the relay (process ${String(pid)}) for ${folder}.` };
  }
  const seconds = String(STOP_WAIT_MS / 1000);
  const message = `Told the relay (process ${String(pid)}) to stop, but it still runs after ${seconds} s.`;
  return { ok: false, message };
}

/**
 * Tells the daemon whose pid is in `<dataDir>/relay.pid` to stop, waits until it is gone, and says
 * what happened. False when it could not be stopped; nothing running there is not a failure.
 */
export async function stopDaemon(dataDir: string): Promise<boolean> {
  const folder = resolve(dataDir);
  const text = await readFile(pidFileIn(folder), "utf8").catch(() => undefined);
  const target = targetOf(text, folder);
  const outcome = typeof target === "number" ? await stopProcess(target, folder) : target;
  (outcome.ok ? console.log : console.error)(outcome.message);
  return outcome.ok;
}
