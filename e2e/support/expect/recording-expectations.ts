import type { SessionEvent } from "@agentcontrol/protocol";
import { eventually } from "../setup/eventually.ts";
import type { RecordedSession } from "../setup/real-recordings.ts";
import type { RelayAccess } from "../setup/relay.ts";
import { allUpdates } from "../setup/updates.ts";

/**
 * The messages the real Claude Code adapter sends that the relay leaves uninterpreted on purpose:
 * sign-in status, the slash command list, a config option echo and the session title. Anything
 * else arriving as `other` is a gap in the normaliser.
 */
const LEFT_ALONE_ON_PURPOSE = [
  "_auth/status_update",
  "auth/status_update",
  "available_commands_update",
  "config_option_update",
  "session_info_update",
];

/** A few logs of some dozens of events each, read on a machine that may be busy with a whole test run. */
const SERVE_TIMEOUT_MS = 17_000;

const eventsOf = (relay: RelayAccess, session: RecordedSession): SessionEvent[] =>
  relay.events.entries.filter((event) => event.sessionId === session.id);

/** The relay has served every recorded event; it also records that the recorded agent is gone. */
function unservedSessions(relay: RelayAccess, sessions: RecordedSession[]): string[] {
  const reached = (session: RecordedSession): boolean =>
    eventsOf(relay, session).some((event) => event.seq === session.lastSeq);
  return sessions.filter((session) => !reached(session)).map((session) => session.name);
}

async function waitsForEveryRecording(
  relay: RelayAccess,
  sessions: RecordedSession[],
): Promise<void> {
  await eventually(
    "expected the relay to serve every event of the recordings",
    () => {
      const missing = unservedSessions(relay, sessions);
      return Promise.resolve(
        missing.length === 0 ? undefined : `${missing.join(", ")} are missing events`,
      );
    },
    SERVE_TIMEOUT_MS,
  );
}

function uninterpretedNames(events: SessionEvent[]): string[] {
  return allUpdates(events).flatMap((update) =>
    update.type === "other" && !LEFT_ALONE_ON_PURPOSE.includes(update.name) ? [update.name] : [],
  );
}

/** Every recorded real session is served, and none of it arrives as `other` except what is left alone on purpose. */
export async function expectRecordingsToBeFullyInterpreted(
  relay: RelayAccess,
  sessions: RecordedSession[],
): Promise<void> {
  await waitsForEveryRecording(relay, sessions);
  for (const session of sessions) {
    const gaps = uninterpretedNames(eventsOf(relay, session));
    if (gaps.length > 0) {
      throw new Error(
        `expected the recording "${session.name}" to be fully interpreted, but ${gaps.join(", ")} arrived as "other"`,
      );
    }
  }
}

/** The recordings cover what the relay claims to read: replies, tool calls, usage and ended turns. */
export async function expectRecordingsToCoverTheSupportedKinds(
  relay: RelayAccess,
  sessions: RecordedSession[],
): Promise<void> {
  const wanted = [
    "agent-text",
    "tool-started",
    "tool-updated",
    "usage",
    "turn-usage",
    "turn-ended",
  ];
  await waitsForEveryRecording(relay, sessions);
  const seen = new Set<string>();
  for (const session of sessions) {
    allUpdates(eventsOf(relay, session)).forEach((update) => seen.add(update.type));
  }
  const missing = wanted.filter((type) => !seen.has(type));
  if (missing.length > 0) {
    throw new Error(
      `expected the recordings to contain ${missing.join(", ")} updates, but none did`,
    );
  }
}
