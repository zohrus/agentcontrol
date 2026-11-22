import { createReadStream } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { SessionEvent, SessionId } from "@agentcontrol/protocol";

const LOG_NAME = "events.jsonl";

/** Path of a session's JSONL file; refuses ids that could escape the log directory. */
export function sessionFile(dir: string, sessionId: SessionId): string {
  if (sessionId.includes("/") || sessionId.includes("\\") || sessionId.startsWith(".")) {
    throw new Error(`Invalid session id: ${sessionId}`);
  }
  return join(dir, sessionId, LOG_NAME);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parseLine(line: string): SessionEvent | undefined {
  try {
    const result = SessionEvent.safeParse(JSON.parse(line));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

async function* parsed(lines: AsyncIterable<string>): AsyncGenerator<SessionEvent> {
  for await (const line of lines) {
    const event = parseLine(line);
    if (event) yield event;
  }
}

async function* streamEvents(file: string): AsyncGenerator<SessionEvent> {
  const stream = createReadStream(file, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    yield* parsed(lines);
  } finally {
    lines.close();
    stream.destroy();
  }
}

/** Streams the valid events of a log file in order; a missing file yields nothing. */
export async function* scanEvents(file: string): AsyncGenerator<SessionEvent> {
  try {
    yield* streamEvents(file);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

async function lastByte(file: string): Promise<number | undefined> {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    if (size === 0) return undefined;
    const { buffer } = await handle.read(Buffer.alloc(1), 0, 1, size - 1);
    return buffer[0];
  } finally {
    await handle.close();
  }
}

/** True when the file is non-empty and its last byte is not a newline (a crash mid-write). */
export async function endsMidLine(file: string): Promise<boolean> {
  try {
    const byte = await lastByte(file);
    return byte !== undefined && byte !== 0x0a;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

/** Ids of every session directory that holds a log file. */
export async function listLogged(dir: string): Promise<SessionId[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const ids: SessionId[] = [];
  for (const name of names) {
    if (await hasLog(join(dir, name, LOG_NAME))) ids.push(SessionId.parse(name));
  }
  return ids;
}

async function hasLog(file: string): Promise<boolean> {
  try {
    const handle = await open(file, "r");
    await handle.close();
    return true;
  } catch {
    return false;
  }
}
