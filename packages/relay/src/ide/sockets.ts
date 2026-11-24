import { type IdeSocketOpenParams, RelayName as N } from "@agentcontrol/protocol";
import type { Client } from "../rpc/index.ts";

/** A WebSocket to code-server, as the tunnel holds it. */
export interface UpstreamSocket {
  protocol: string;
  send: (call: { data: string; binary: boolean }) => void;
  close: () => void;
}

/** What the browser's handshake carries that the upstream handshake makes for itself. */
const OWN_HANDSHAKE = new Set([
  "connection",
  "upgrade",
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-extensions",
  "sec-websocket-protocol",
  "sec-websocket-accept",
  "content-length",
]);

/** Unread bytes on the link past which a WebSocket is ended instead of buffering without limit. */
const MAX_UNREAD_BYTES = 32 * 1024 * 1024;

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve();
    });
    socket.addEventListener("error", () => {
      reject(new Error("code-server refused the WebSocket."));
    });
  });
}

function relayMessage(data: unknown): { data: string; binary: boolean } {
  if (typeof data === "string")
    return { data: Buffer.from(data).toString("base64"), binary: false };
  return { data: Buffer.from(data as ArrayBuffer).toString("base64"), binary: true };
}

/** Forwards what code-server sends; a browser too slow to take it ends the socket, nothing is dropped. */
function forward(call: {
  socket: WebSocket;
  tunnelId: string;
  client: Client;
  onClosed: () => void;
}): void {
  const { socket, tunnelId, client } = call;
  socket.addEventListener("message", (event) => {
    if (client.backlog() > MAX_UNREAD_BYTES) {
      socket.close(1013, "the reader is too slow");
      return;
    }
    client.notify(N.ideSocketMessage, { tunnelId, ...relayMessage(event.data) });
  });
  socket.addEventListener("close", (event) => {
    call.onClosed();
    client.notify(N.ideSocketClosed, { tunnelId, code: event.code, reason: event.reason });
  });
}

/** Sends a browser message on; past 32 MiB waiting for code-server it fails (and the socket ends). */
function sendWithinLimit(socket: WebSocket, message: { data: string; binary: boolean }): void {
  if (socket.bufferedAmount > MAX_UNREAD_BYTES) {
    throw new Error("code-server is too slow to take the data");
  }
  const bytes = Buffer.from(message.data, "base64");
  socket.send(message.binary ? bytes : bytes.toString("utf8"));
}

/** Opens the WebSocket to code-server's socket with the browser's own handshake headers (Host, Origin). */
export async function openUpstreamSocket(call: {
  socketPath: string;
  params: IdeSocketOpenParams;
  client: Client;
  /** Called once when the socket has ended, whoever ended it. */
  onClosed: () => void;
}): Promise<UpstreamSocket> {
  const { socketPath, params, client } = call;
  const headers = params.headers.filter(([name]) => !OWN_HANDSHAKE.has(name.toLowerCase()));
  const socket = new WebSocket(`ws+unix://${socketPath}:${params.path}`, {
    headers: Object.fromEntries(headers),
    protocols: params.protocols,
  });
  socket.binaryType = "arraybuffer";
  // Listening starts before the open is awaited, so the first message is never missed.
  forward({ socket, tunnelId: params.tunnelId, client, onClosed: call.onClosed });
  await opened(socket);
  return {
    protocol: socket.protocol,
    send: (message) => {
      sendWithinLimit(socket, message);
    },
    close: () => {
      socket.close(1000);
    },
  };
}
