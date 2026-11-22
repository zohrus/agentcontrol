import { RelayName as N } from "@agentcontrol/protocol";
import type { Client, Handlers } from "../rpc/index.ts";
import type { Sessions } from "../sessions/index.ts";

type SessionMethods =
  | typeof N.sessionsList
  | typeof N.sessionsCreate
  | typeof N.eventsSubscribe
  | typeof N.eventsRead
  | typeof N.prompt
  | typeof N.permissionRespond
  | typeof N.cancel
  | typeof N.sessionsArchive;

/** Streams events, and the summaries that change, to the client until it disconnects. */
async function subscribe(call: {
  sessions: Sessions;
  params: Parameters<Sessions["follow"]>[0];
  client: Client;
}): Promise<void> {
  const { sessions, params, client } = call;
  const stop = await sessions.follow(params, (event) => {
    client.notify(N.event, { event });
  });
  client.onClose(stop);
  const sessionId = "sessionId" in params ? params.sessionId : undefined;
  const stopSummaries = sessions.followSummaries(sessionId, (changed) => {
    client.notify(N.sessionsChanged, { sessions: changed });
  });
  client.onClose(stopSummaries);
}

/** The methods that drive a session's life: list, create, talk to the agent, archive, follow. */
export function sessionHandlers(sessions: Sessions): Pick<Handlers, SessionMethods> {
  return {
    [N.sessionsList]: async () => ({ sessions: await sessions.list() }),
    [N.sessionsCreate]: async (params) => ({ sessionId: await sessions.create(params) }),
    [N.eventsSubscribe]: async (params, client) => {
      await subscribe({ sessions, params, client });
      return {};
    },
    [N.eventsRead]: async ({ sessionId }) => ({ events: await sessions.events(sessionId) }),
    [N.prompt]: async (params) => {
      await sessions.prompt(params);
      return {};
    },
    [N.permissionRespond]: async (params) => {
      await sessions.respond(params);
      return {};
    },
    [N.cancel]: async ({ sessionId }) => {
      await sessions.cancel(sessionId);
      return {};
    },
    [N.sessionsArchive]: ({ sessionId, force }) =>
      sessions.archive({ sessionId, force: force ?? false }),
  };
}
