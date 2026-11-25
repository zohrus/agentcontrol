import { existsSync } from "node:fs";
import { connect, type Socket } from "node:net";
import { join } from "node:path";
import { RelayName as N } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { eventually } from "./eventually.ts";
import type { Session } from "./relay.ts";
import type { RunningRelay } from "./start-relay.ts";
import { Timeline } from "./timeline.ts";

async function runsAndWaitsFor(call: { socket: Socket; terminalId: string; shell: Shell }) {
  const { socket, terminalId, shell } = call;
  types({ socket, terminalId, text: `${shell.command}\n` });
  await eventuallyDone(shell.doneFile);
}

/** A command for a shell, and the file it creates last. */
interface Shell {
  command: string;
  doneFile: string;
}

/** A flood of 40 MB must end before the test does, even on a busy machine. */
export const FLOOD_WAIT_MS = 15_000;

function eventuallyDone(doneFile: string): Promise<void> {
  return eventually(
    "expected the shell to finish its command",
    () => Promise.resolve(existsSync(doneFile) ? undefined : "it has not finished"),
    FLOOD_WAIT_MS,
  );
}

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
  requestId?: number;
}): Promise<string> {
  const id = call.requestId ?? 1;
  const params = { sessionId: call.session.id, cols: 80, rows: 24 };
  send(call.socket, { id, method: N.terminalOpen, params });
  const answer = await call.lines.waitFor(
    (line) => line.includes(`"id":${String(id)},`) || line.includes(`"id":${String(id)}}`),
    "expected the relay to open the terminal",
  );
  return (JSON.parse(answer) as { result: { terminalId: string } }).result.terminalId;
}

function types(call: { socket: Socket; terminalId: string; text: string }): void {
  const { socket, terminalId, text } = call;
  send(socket, { id: 2, method: N.terminalWrite, params: { terminalId, data: text } });
}

function dataOf(line: string): { terminalId?: string; data?: string } {
  const message = JSON.parse(line) as { method?: string; params?: object };
  return message.method === N.terminalData ? (message.params ?? {}) : {};
}

function textOf(line: string): string {
  return dataOf(line).data ?? "";
}

function textOfTerminal(call: { line: string; terminalId: string }): string {
  const { terminalId, data } = dataOf(call.line);
  return terminalId === call.terminalId ? (data ?? "") : "";
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
  await eventuallyDone(call.doneFile);
  socket.resume();
  types({ socket, terminalId, text: "exit\n" });
  await lines.waitFor((line) => line.includes(N.terminalExit), "expected the shell to end");
  return { receivedBytes: seen.bytes, text: lines.entries.map(textOf).join("") };
}

/** What a second terminal showed while the first one flooded the connection that nobody read. */
export interface QuietTerminalReading {
  /** Everything the second terminal's shell printed that the relay did send. */
  text: string;
}

/**
 * A program connected straight to the relay with two terminals open on the session. It stops
 * reading, the first shell prints `flood` (which must create its `doneFile` last), then the second
 * shell prints `quiet` (the same); only then does the program read.
 */
export async function readsASecondTerminalWhileTheFirstOneFloods(
  relay: RunningRelay,
  call: { session: Session; flood: Shell; quiet: Shell },
): Promise<QuietTerminalReading> {
  const { socket, lines } = connectedTo(relay);
  const { session } = call;
  const flooding = await opensATerminal({ socket, lines, session });
  const quiet = await opensATerminal({ socket, lines, session, requestId: 3 });
  socket.pause();
  await runsAndWaitsFor({ socket, terminalId: flooding, shell: call.flood });
  await runsAndWaitsFor({ socket, terminalId: quiet, shell: call.quiet });
  socket.resume();
  for (const terminalId of [flooding, quiet]) types({ socket, terminalId, text: "exit\n" });
  await lines.waitFor(
    () => lines.entries.filter((line) => line.includes(N.terminalExit)).length === 2,
    "expected both shells to end",
  );
  return {
    text: lines.entries.map((line) => textOfTerminal({ line, terminalId: quiet })).join(""),
  };
}
