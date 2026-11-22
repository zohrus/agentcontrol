import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AnyMessage, Stream } from "@agentclientprotocol/sdk";

export type Direction = "agent->client" | "client->agent" | "note";

export type LogLine = { ts: string; dir: Direction; message: unknown };

/** Writes one JSON line per entry to stdout and to a file. */
export function createLogger(file: string): (dir: Direction, message: unknown) => void {
  mkdirSync(dirname(file), { recursive: true });
  return (dir, message) => {
    const line: LogLine = { ts: new Date().toISOString(), dir, message };
    const text = JSON.stringify(line);
    appendFileSync(file, `${text}\n`);
    console.log(text);
  };
}

function tap(onMessage: (message: AnyMessage) => void): TransformStream<AnyMessage, AnyMessage> {
  return new TransformStream({
    transform(message, controller) {
      onMessage(message);
      controller.enqueue(message);
    },
  });
}

/** Wraps a stream so every message that crosses it is logged, unchanged. */
export function logStream(stream: Stream, log: ReturnType<typeof createLogger>): Stream {
  const outbound = tap((message) => log("client->agent", message));
  outbound.readable.pipeTo(stream.writable).catch(() => undefined);
  const inbound = stream.readable.pipeThrough(tap((message) => log("agent->client", message)));
  return { writable: outbound.writable, readable: inbound };
}
