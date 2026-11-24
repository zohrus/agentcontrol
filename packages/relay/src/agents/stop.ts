import type { SpawnedAgent } from "./spawn.ts";

/** How long an agent, and what it started, may take to end after being asked to, before they are killed. */
const STOP_GRACE_MS = 2000;
const POLL_MS = 25;

/** Resolves once the process group is gone, or when the time is up, whichever is first. */
async function untilGone(spawned: SpawnedAgent, deadline: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, deadline - Date.now()));
  });
  await Promise.race([spawned.exited, late]);
  clearTimeout(timer);
  // The adapter may be gone while the CLI it started is still ending.
  while (spawned.running() && Date.now() < deadline) await Bun.sleep(POLL_MS);
}

/**
 * Asks the agent, and the CLI it started, to end; kills whatever is left after the grace period.
 * Without the bound a wedged agent would hold up an archive or the relay's own stop.
 */
export async function stopProcess(spawned: SpawnedAgent): Promise<void> {
  const deadline = Date.now() + STOP_GRACE_MS;
  spawned.kill("SIGTERM");
  await untilGone(spawned, deadline);
  if (spawned.running()) spawned.kill("SIGKILL");
  await spawned.exited;
}
