import { readFile } from "node:fs/promises";
import { isAlive } from "./alive.ts";

/** Longest wait for a relay that is shutting down; a pid that lives on is then taken as stale. */
const STOPPING_WAIT_MS = 10_000;
const POLL_MS = 20;

/** The process id in the pid file, when it names another process. */
async function otherProcessIn(pidFile: string): Promise<number | undefined> {
  const pid = Number(await readFile(pidFile, "utf8").catch(() => ""));
  return Number.isInteger(pid) && pid > 0 && pid !== process.pid ? pid : undefined;
}

/**
 * A relay that was told to stop stays alive for a while (its agents and clients are ended first),
 * and removes its socket and pid file as its last act. A relay that starts in that time and made
 * its own files would have them removed by the old one, so it waits until the old process is gone.
 * Nothing to wait for when the pid file is missing or names this process or a dead one.
 */
export async function waitForStoppingRelay(pidFile: string): Promise<void> {
  const pid = await otherProcessIn(pidFile);
  if (pid === undefined) return;
  const deadline = Date.now() + STOPPING_WAIT_MS;
  while (isAlive(pid) && Date.now() < deadline) await Bun.sleep(POLL_MS);
}
