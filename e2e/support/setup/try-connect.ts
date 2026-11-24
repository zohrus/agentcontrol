import { connect, type Socket } from "node:net";

/** Connects to the socket, or resolves undefined when nothing accepts connections there. */
export function tryConnect(path: string): Promise<Socket | undefined> {
  return new Promise((resolve) => {
    const socket = connect(path);
    socket.once("connect", () => {
      resolve(socket);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(undefined);
    });
  });
}
