import { existsSync } from "node:fs";
import { connect, type Socket } from "node:net";
import { join } from "node:path";
import { RelayName as N } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { eventually } from "./eventually.ts";
import type { Session } from "./relay.ts";
import type { RunningRelay } from "./start-relay.ts";
import { Timeline } from "./timeline.ts";

/** What a program that reads a terminal's output slowly got in the end. */
export interface SlowReading {
  /** Bytes of terminal output the relay sent, as JSON lines. */
  receivedBytes: number;
  /** Everything the shell printed that the relay did send. */
  text: string;
}

function send(socket: Socket, call: { id: number; method: string; params: object }): void {
  socket.write(`${JSON.stringify({ jsonrpc: "2.0", ...call })}\n`);
}

/** Connects to the relay's socket and records its lines as they come, and how many bytes. */
function connectedTo(relay: RunningRelay) {
  const socket = connect(join(relay.dataDir, "relay.sock"));
  onTestEnd(() => {
    socket.destroy();
    return Promise.resolve();
  });
  const lines = new Timeline<string>(15_000);
  const seen = { bytes: 0 };
  let rest = "";
  socket.on("data", (chunk: Buffer) => {
    seen.bytes += chunk.length;
    const parts = (rest + chunk.toString("utf8")).split("\n");
    rest = parts.pop() ?? "";
    for (const line of parts) lines.record(line);
  });
  return { socket, lines, seen };
}

/** Opens a terminal on the session; the relay's answer names it. */
async function opensATerminal(call: {
  socket: Socket;
  lines: Timeline<string>;
  session: Session;
}): Promise<string> {
  const params = { sessionId: call.session.id, cols: 80, rows: 24 };
  send(call.socket, { id: 1, method: N.terminalOpen, params });
  const answer = await call.lines.waitFor(
    (line) => line.includes('"id":1'),
    "expected the relay to open the terminal",
  );
  return (JSON.parse(answer) as { result: { terminalId: string } }).result.terminalId;
}

function types(call: { socket: Socket; terminalId: string; text: string }): void {
  const { socket, terminalId, text } = call;
  send(socket, { id: 2, method: N.terminalWrite, params: { terminalId, data: text } });
}

function textOf(line: string): string {
  const message = JSON.parse(line) as { method?: string; params?: { data?: string } };
  return message.method === N.terminalData ? (message.params?.data ?? "") : "";
}

/**
 * A program connected straight to the relay that opens a terminal on the session, then stops
 * reading from the relay while the shell runs `command`, and reads everything only when the shell
 * has finished (`command` must create `doneFile` last).
 */
export async function readsTerminalOutputOnlyAfterTheShellFinishes(
  relay: RunningRelay,
  call: { session: Session; command: string; doneFile: string },
): Promise<SlowReading> {
  const { socket, lines, seen } = connectedTo(relay);
  const terminalId = await opensATerminal({ socket, lines, session: call.session });
  socket.pause();
  types({ socket, terminalId, text: `${call.command}\n` });
  await eventually("expected the shell to finish its command", () =>
    Promise.resolve(existsSync(call.doneFile) ? undefined : "it has not finished"),
  );
  socket.resume();
  types({ socket, terminalId, text: "exit\n" });
  await lines.waitFor((line) => line.includes(N.terminalExit), "expected the shell to end");
  return { receivedBytes: seen.bytes, text: lines.entries.map(textOf).join("") };
}
