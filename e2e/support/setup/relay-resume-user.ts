import { RelayName } from "@agentcontrol/protocol";
import { attempt } from "./attempt.ts";
import type { RelayAccess, Session } from "./relay.ts";
import { forSession } from "./session-events.ts";

/** Getting an interrupted session going again, as relay calls. */
export function resumeUserOf(relay: RelayAccess) {
  return {
    resumesSession: (session: Session) =>
      relay.call(RelayName.sessionsResume, { sessionId: session.id }),
    triesToResumeSession: (session: Session) =>
      attempt(relay.call(RelayName.sessionsResume, { sessionId: session.id })),
    /** Presses Send twice before the first message has been taken. */
    sendsTwoMessagesAtOnce: (session: Session) =>
      Promise.all(
        ["First", "Second"].map((text) =>
          attempt(relay.call(RelayName.prompt, { sessionId: session.id, text })),
        ),
      ),
    /** Waits until the session's agent process has ended, however it ended. */
    waitsForTheAgentToExit: async (session: Session): Promise<void> => {
      await relay.events.waitFor(
        forSession(session, "agent-exited"),
        `expected the agent of session "${session.title}" to exit`,
      );
    },
  };
}
