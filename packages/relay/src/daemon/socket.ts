import { type Socket, connect } from "node:net";
import { join } from "node:path";

/** Where the daemon listens inside its data folder. */
export function socketPathIn(dataDir: string): string {
  return join(dataDir, "relay.sock");
}

/** Connects to the socket, or resolves undefined when nothing is accepting connections there. */
export function tryConnect(socketPath: string): Promise<Socket | undefined> {
  return new Promise((resolve) => {
    const socket = connect(socketPath);
    socket.once("connect", () => {
      resolve(socket);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(undefined);
    });
  });
}
