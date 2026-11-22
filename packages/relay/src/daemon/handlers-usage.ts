import { RelayName as N, type SessionId } from "@agentcontrol/protocol";
import type { Handlers } from "../rpc/index.ts";
import type { Sessions } from "../sessions/index.ts";
import { usageFromEvents } from "../usage/index.ts";

async function sessionsToRead(sessions: Sessions, sessionId?: SessionId): Promise<SessionId[]> {
  if (sessionId !== undefined) return [sessionId];
  return (await sessions.list()).map((summary) => summary.id);
}

/** The methods about what sessions cost: token usage per finished turn. */
export function usageHandlers(sessions: Sessions): Pick<Handlers, typeof N.usage> {
  return {
    [N.usage]: async ({ sessionId }) => {
      const ids = await sessionsToRead(sessions, sessionId);
      const perSession = await Promise.all(
        ids.map(async (id) => usageFromEvents(await sessions.events(id))),
      );
      return { rows: perSession.flat() };
    },
  };
}
