import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DaemonFolder } from "./daemon-process.ts";
import { eventually } from "./eventually.ts";
import { tryConnect } from "./try-connect.ts";

const socketOf = (folder: DaemonFolder): string => join(folder.dataDir, "relay.sock");

/** Waits until the relay in the folder has stopped listening, though it is still shutting down. */
export async function waitsUntilTheRelayTakesNoMoreClients(folder: DaemonFolder): Promise<void> {
  await eventually("expected the relay to stop taking clients", async () => {
    const socket = await tryConnect(socketOf(folder));
    socket?.destroy();
    return socket === undefined ? undefined : "it still accepts connections";
  });
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
