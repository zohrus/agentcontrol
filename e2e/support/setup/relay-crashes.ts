import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { Session } from "./relay.ts";
import type { RunningRelay } from "./start-relay.ts";

const logOf = (relay: RunningRelay, session: Session): string =>
  join(relay.dataDir, "sessions", session.id, "events.jsonl");

/** Cuts the session's log right after its first event of this kind, as if the relay died then. */
async function logEndsAfter(file: string, kind: string): Promise<void> {
  const lines = (await Bun.file(file).text()).split("\n").filter((line) => line !== "");
  const kinds = lines.map((line) => (JSON.parse(line) as { kind: string }).kind);
  await Bun.write(file, `${lines.slice(0, kinds.indexOf(kind) + 1).join("\n")}\n`);
}

/** The relay is killed during the session's worktree setup, so the log never says it finished. */
export function relayIsKilledDuringSetup(relay: RunningRelay, session: Session): Promise<void> {
  return relay.restartsTheRelay({
    whileDown: () => logEndsAfter(logOf(relay, session), "session-created"),
  });
}

/** The relay is killed while the agent works: the log ends with the agent up and no exit. */
export function relayIsKilledWhileTheAgentWorks(
  relay: RunningRelay,
  session: Session,
): Promise<void> {
  return relay.restartsTheRelay({
    whileDown: () => logEndsAfter(logOf(relay, session), "agent-started"),
  });
}

/** The relay is killed while the agent waits for an answer: the log ends with the request. */
export function relayIsKilledWhileTheAgentWaitsForApproval(
  relay: RunningRelay,
  session: Session,
): Promise<void> {
  return relay.restartsTheRelay({
    whileDown: () => logEndsAfter(logOf(relay, session), "permission-requested"),
  });
}

/** The relay is killed in the middle of writing an event: the log's last line is cut off. */
export function relayIsKilledMidWrite(relay: RunningRelay, session: Session): Promise<void> {
  const file = logOf(relay, session);
  return relay.restartsTheRelay({
    whileDown: async () => {
      await logEndsAfter(file, "prompt-sent");
      await appendFile(file, '{"seq":99,"kind":"turn-ended","payl');
    },
  });
}
