import { existsSync } from "node:fs";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import type { DaemonFolder } from "./daemon-process.ts";
import { eventually } from "./eventually.ts";
import { tryConnect } from "./try-connect.ts";

const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");

const socketOf = (folder: DaemonFolder): string => join(folder.dataDir, "relay.sock");

/** Waits until the relay in the folder has stopped listening, though it is still shutting down. */
export async function waitsUntilTheRelayTakesNoMoreClients(folder: DaemonFolder): Promise<void> {
  await eventually("expected the relay to stop taking clients", async () => {
    const socket = await tryConnect(socketOf(folder));
    socket?.destroy();
    return socket === undefined ? undefined : "it still accepts connections";
  });
}

/** Starts another relay daemon in the folder and returns at once, without waiting for it to listen. */
export function aNewRelayStartsIn(folder: DaemonFolder): number {
  const daemon = Bun.spawn(["bun", relayMain, "daemon", "--data-dir", folder.dataDir], {
    stdout: "ignore",
    stderr: "inherit",
  });
  onTestEnd(() => {
    daemon.kill("SIGKILL");
    return Promise.resolve();
  });
  return daemon.pid;
}

/** Waits until a client can connect to the folder's relay socket; what the relay's pid file says. */
export async function connectsToTheRelayInTheFolder(
  folder: DaemonFolder,
): Promise<{ pidFile: string }> {
  await eventually("expected to be able to connect to the relay in the folder", async () => {
    const socket = existsSync(socketOf(folder)) ? await tryConnect(socketOf(folder)) : undefined;
    socket?.destroy();
    return socket === undefined ? "nothing accepts connections there" : undefined;
  });
  const pidFile = await Bun.file(join(folder.dataDir, "relay.pid"))
    .text()
    .catch(() => "");
  return { pidFile };
}
