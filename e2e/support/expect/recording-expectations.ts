import type { SessionEvent } from "@agentcontrol/protocol";
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

async function eventsOf(relay: RelayAccess, session: RecordedSession): Promise<SessionEvent[]> {
  const last = await relay.events.waitFor(
    (event) => event.sessionId === session.id && event.seq === session.lastSeq,
    `expected the relay to serve all ${String(session.lastSeq)} events of the recording "${session.name}"`,
  );
  return relay.events.entries.filter((event) => event.sessionId === last.sessionId);
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
  for (const session of sessions) {
    const gaps = uninterpretedNames(await eventsOf(relay, session));
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
  const seen = new Set<string>();
  for (const session of sessions) {
    allUpdates(await eventsOf(relay, session)).forEach((update) => seen.add(update.type));
  }
  const missing = wanted.filter((type) => !seen.has(type));
  if (missing.length > 0) {
    throw new Error(
      `expected the recordings to contain ${missing.join(", ")} updates, but none did`,
    );
  }
}
