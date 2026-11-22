import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SessionId } from "@agentcontrol/protocol";
import type { RunningRelay } from "./start-relay.ts";
import type { Session } from "./relay.ts";

const fixture = join(import.meta.dir, "../../fixtures/pre-normalisation/events.jsonl");
const RECORDED_ID = "11111111-2222-4333-8444-555555555555" as SessionId;

/**
 * Puts a session log written before normalised updates existed (raw ACP only) into the relay's
 * data folder and restarts the relay, as if the user had upgraded with that session on disk.
 */
export async function relayHoldsSessionRecordedBeforeNormalisation(
  relay: RunningRelay,
): Promise<Session> {
  const folder = join(relay.dataDir, "sessions", RECORDED_ID);
  await mkdir(folder, { recursive: true });
  await copyFile(fixture, join(folder, "events.jsonl"));
  await relay.restartsTheRelay();
  return { id: RECORDED_ID, title: "Old session" };
}
