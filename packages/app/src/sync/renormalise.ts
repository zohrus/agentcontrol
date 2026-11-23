import { RelayName, type SessionId } from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";
import type { SyncDeps } from "./deps.ts";

/** Asks the relay for the whole session as it translates it now, and swaps it in for the saved one. */
async function renormaliseSession(call: {
  client: RelayClient;
  deps: SyncDeps;
  sessionId: SessionId;
  version: number;
}): Promise<void> {
  const { client, deps, sessionId, version } = call;
  const workspaceId = deps.workspace.id;
  const { events } = await client.call(RelayName.eventsRead, { sessionId });
  deps.store.replaceSessionEvents({ workspaceId, sessionId, list: events, version });
  events.forEach((event) => {
    deps.hub.publish({ type: "event", workspaceId, event });
  });
}

/**
 * Sessions saved with an older translation of the agents' messages are read again from the relay,
 * one after the other. Each replaced event is published again, with its seq and its new payload,
 * so a UI that shows it can update it. A session the relay cannot give is tried again next time.
 */
export async function renormaliseStaleSessions(call: {
  client: RelayClient;
  deps: SyncDeps;
  version: number;
}): Promise<void> {
  const { client, deps, version } = call;
  const stale = deps.store.sessionsNormalisedBefore({ workspaceId: deps.workspace.id, version });
  for (const sessionId of stale) {
    await renormaliseSession({ client, deps, sessionId, version }).catch(() => undefined);
  }
}
