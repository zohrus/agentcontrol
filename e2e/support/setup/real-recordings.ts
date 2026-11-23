import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SessionId } from "@agentcontrol/protocol";
import type { Session } from "./relay.ts";
import type { RunningRelay } from "./start-relay.ts";

const recordingsDir = join(import.meta.dir, "../../fixtures/recordings/claude-code");

/** A session recorded from the real Claude Code adapter: the relay's own event log of that run. */
export interface RecordedSession extends Session {
  /** The scenario of `scripts/real-agent-smoke.ts` that made the recording, e.g. "edit-with-approval". */
  readonly name: string;
  /** Sequence number of the last event in the log. */
  readonly lastSeq: number;
}

interface FirstAndLast {
  sessionId: SessionId;
  lastSeq: number;
}

async function describeLog(file: string): Promise<FirstAndLast> {
  const lines = (await Bun.file(file).text()).trim().split("\n");
  const first = JSON.parse(lines[0] ?? "{}") as { sessionId: SessionId };
  const last = JSON.parse(lines.at(-1) ?? "{}") as { seq: number };
  return { sessionId: first.sessionId, lastSeq: last.seq };
}

async function placeInRelay(relay: RunningRelay, file: string): Promise<RecordedSession> {
  const { sessionId, lastSeq } = await describeLog(join(recordingsDir, file));
  const folder = join(relay.dataDir, "sessions", sessionId);
  await mkdir(folder, { recursive: true });
  await copyFile(join(recordingsDir, file), join(folder, "events.jsonl"));
  const name = file.replace(/\.jsonl$/, "");
  return { id: sessionId, title: name, name, lastSeq };
}

/**
 * Puts every recording of a real Claude Code run (`e2e/fixtures/recordings/claude-code`) into the
 * relay's data folder, restarts the relay so it reads them, and follows each from its start.
 */
export async function relayHoldsTheRealClaudeCodeRecordings(
  relay: RunningRelay,
): Promise<RecordedSession[]> {
  const files = (await readdir(recordingsDir)).filter((file) => file.endsWith(".jsonl")).sort();
  const sessions = await Promise.all(files.map((file) => placeInRelay(relay, file)));
  await relay.restartsTheRelay();
  await Promise.all(sessions.map((session) => relay.followsSessionAfter(session, 0)));
  return sessions;
}
