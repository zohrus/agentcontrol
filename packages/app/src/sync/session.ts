import {
  type HelloResult,
  VERSION,
  RelayName,
  RelayNotifications,
  type SessionEvent,
  type SessionSummary,
} from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";
import { createBatcher } from "./batcher.ts";
import type { SyncDeps } from "./deps.ts";
import { renormaliseStaleSessions } from "./renormalise.ts";
import { saveChangedSummaries } from "./summaries.ts";

const EVENT_BATCH_MS = 20;

export interface SyncSession {
  hello: HelloResult;
  /** Fetches the relay's session list now and publishes what changed. */
  refreshSessions: () => Promise<void>;
  /** Saves and publishes whatever events are still waiting. */
  flush: () => void;
}

/** Saves summaries the relay sent and tells the hub which ones are news. */
function saveSummaries(deps: SyncDeps) {
  return (summaries: SessionSummary[]): void => {
    const workspaceId = deps.workspace.id;
    const changed = saveChangedSummaries({ store: deps.store, workspaceId, summaries });
    if (changed.length > 0) deps.hub.publish({ type: "sessions", workspaceId, sessions: changed });
  };
}

/** Batches the relay's events; `version` is the relay's translation version once it has said it. */
function receiver(deps: SyncDeps, version: () => number) {
  return createBatcher<SessionEvent>({
    delayMs: EVENT_BATCH_MS,
    handle: (events) => {
      const workspaceId = deps.workspace.id;
      deps.store.saveEvents({ workspaceId, list: events, normaliserVersion: version() });
      events.forEach((event) => {
        deps.hub.publish({ type: "event", workspaceId, event });
      });
    },
  });
}

/** Routes the relay's pushes: events are batched, summary changes are saved at once. */
function relayPushes(options: {
  client: RelayClient;
  onEvent: (event: SessionEvent) => void;
  onSummaries: (summaries: SessionSummary[]) => void;
}): void {
  const { client, onEvent, onSummaries } = options;
  client.onNotification(({ method, params }) => {
    if (method === RelayName.event) {
      onEvent(RelayNotifications[RelayName.event].parse(params).event);
    } else if (method === RelayName.sessionsChanged) {
      onSummaries(RelayNotifications[RelayName.sessionsChanged].parse(params).sessions);
    }
  });
}

/** Follows every session after the last stored seq, lists them once, and returns how to list again. */
async function followAndList(call: {
  client: RelayClient;
  deps: SyncDeps;
  onSummaries: (summaries: SessionSummary[]) => void;
}): Promise<() => Promise<void>> {
  const { client, deps, onSummaries } = call;
  const afterSeq = deps.store.lastSeqs(deps.workspace.id);
  await client.call(RelayName.eventsSubscribe, { afterSeq });
  const refreshSessions = async (): Promise<void> => {
    onSummaries((await client.call(RelayName.sessionsList, {})).sessions);
  };
  await refreshSessions();
  return refreshSessions;
}

/**
 * Handshake, resume every session after the last stored seq, and list the sessions once. Sessions
 * saved with an older event translation than the relay's are read again in the background. From then
 * on the relay pushes every change (`relay/sessions.changed`), so nothing here polls or has to know
 * which events change a session's status.
 */
export async function startSyncSession(client: RelayClient, deps: SyncDeps): Promise<SyncSession> {
  let normaliserVersion = 0;
  const events = receiver(deps, () => normaliserVersion);
  const onSummaries = saveSummaries(deps);
  relayPushes({ client, onEvent: events.add, onSummaries });
  const hello = await client.call(RelayName.hello, { clientVersion: VERSION });
  normaliserVersion = hello.normaliserVersion ?? 0;
  deps.store.upsertWorkspace({ ...deps.workspace, lastSeenAt: new Date().toISOString() });
  const refreshSessions = await followAndList({ client, deps, onSummaries });
  void renormaliseStaleSessions({ client, deps, version: normaliserVersion }).catch(
    () => undefined,
  );
  return { hello, refreshSessions, flush: events.flush };
}
