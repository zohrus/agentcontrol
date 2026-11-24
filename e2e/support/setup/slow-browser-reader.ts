import { existsSync } from "node:fs";
import { connect, type Socket } from "node:net";
import { TERMINAL_PROTOCOL, TOKEN_PROTOCOL_PREFIX } from "@agentcontrol/protocol";
import type { AppAccess, Session } from "./app.ts";
import { onTestEnd } from "./cleanup.ts";
import { eventually } from "./eventually.ts";
import type { SlowReading } from "./slow-terminal-reader.ts";

const SHELL_FINISH_WAIT_MS = 15_000;

/** A masked WebSocket text frame (the mask is all zeros, which leaves the text as it is). */
function textFrame(message: object): Buffer {
  const payload = Buffer.from(JSON.stringify(message));
  const size = payload.length;
  const head =
    size < 126
      ? Buffer.from([0x81, 0x80 | size])
      : Buffer.from([0x81, 0x80 | 126, size >> 8, size & 0xff]);
  return Buffer.concat([head, Buffer.alloc(4), payload]);
}

function upgradeRequest(app: AppAccess, session: Session): string {
  const { host } = new URL(app.baseUrl);
  const protocols = `${TERMINAL_PROTOCOL}, ${TOKEN_PROTOCOL_PREFIX}${app.token}`;
  return [
    `GET /api/sessions/${session.id}/terminal HTTP/1.1`,
    `Host: ${host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Sec-WebSocket-Version: 13",
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
    `Sec-WebSocket-Protocol: ${protocols}`,
    "",
    "",
  ].join("\r\n");
}

/** Connects to the app and records every byte it sends. */
function connectedTo(app: AppAccess) {
  const { hostname, port } = new URL(app.baseUrl);
  const socket = connect({ host: hostname, port: Number(port) });
  onTestEnd(() => {
    socket.destroy();
    return Promise.resolve();
  });
  const seen = { bytes: 0, text: "" };
  socket.on("data", (chunk: Buffer) => {
    seen.bytes += chunk.length;
    seen.text += chunk.toString("latin1");
  });
  return { socket, seen };
}

function types(socket: Socket, text: string): void {
  socket.write(textFrame({ type: "input", data: text }));
}

/** Resolves when the bytes seen so far include `piece`. */
function untilSeen(seen: { text: string }, piece: string): Promise<void> {
  return eventually(`expected the app to send ${piece}`, () =>
    Promise.resolve(seen.text.includes(piece) ? undefined : "it has not"),
  );
}

/**
 * A browser that opens the session's terminal, then stops reading from the app while the shell
 * runs `command` (which must create `doneFile` last), and reads only when the shell has finished.
 */
export async function readsTheTerminalOnlyAfterTheShellFinishes(
  app: AppAccess,
  call: { session: Session; command: string; doneFile: string },
): Promise<SlowReading> {
  const { socket, seen } = connectedTo(app);
  socket.write(upgradeRequest(app, call.session));
  await untilSeen(seen, " 101 ");
  socket.write(textFrame({ type: "open", cols: 80, rows: 24 }));
  types(socket, `${call.command}\n`);
  socket.pause();
  // The shell writes megabytes against a paused reader: on a busy machine that takes a while.
  await eventually(
    "expected the shell to finish its command",
    () => Promise.resolve(existsSync(call.doneFile) ? undefined : "it has not finished"),
    SHELL_FINISH_WAIT_MS,
  );
  socket.resume();
  types(socket, "exit\n");
  await untilSeen(seen, '"type":"exit"');
  return { receivedBytes: seen.bytes, text: seen.text };
}
