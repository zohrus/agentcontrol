import type { Insight, SessionAnalytics } from "./types.ts";

/** The sessions an insight points at, as ids and as references that say which workspace each is in. */
export function pointingAt(sessions: SessionAnalytics[]): Pick<Insight, "sessionIds" | "sessions"> {
  return {
    sessionIds: sessions.map((s) => s.sessionId),
    sessions: sessions.map((s) => ({
      workspaceId: s.workspaceId,
      sessionId: s.sessionId,
      title: s.title,
    })),
  };
}
