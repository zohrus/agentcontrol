import {
  type HelloResult,
  RelayName,
  RelayNotifications,
  type SessionEvent,
} from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";
import type { Store, Workspace } from "../store/index.ts";
import { createBatcher } from "./batcher.ts";
import { createCoalescer } from "./coalescer.ts";
import type { Hub } from "./hub.ts";
import { saveChangedSummaries } from "./summaries.ts";

const EVENT_BATCH_MS = 20;
const REFRESH_MS = 50;
const CLIENT_VERSION = "0.0.0";

/** Event kinds after which a session's status may have changed, so its summary is refetched. */
const STATUS_CHANGING = new Set<SessionEvent["kind"]>([
  "session-created",
  "setup-finished",
  "agent-started",
  "agent-exited",
  "permission-requested",
  "permission-answered",
  "prompt-sent",
  "turn-ended",
  "session-archived",
]);

export interface SyncSession {
  hello: HelloResult;
  /** Fetches the relay's session list now and publishes what changed. */
  refreshSessions: () => Promise<void>;
  /** Saves and publishes whatever events are still waiting. */
  flush: () => void;
}

export interface SyncDeps {
  store: Store;
  hub: Hub;
  workspace: Workspace;
}

function refresher(client: RelayClient, deps: SyncDeps) {
  return createCoalescer({
    delayMs: REFRESH_MS,
    task: async () => {
      const { sessions } = await client.call(RelayName.sessionsList, {});
      const workspaceId = deps.workspace.id;
      const changed = saveChangedSummaries({ store: deps.store, workspaceId, summaries: sessions });
      if (changed.length > 0) deps.hub.publish({ type: "sessions", sessions: changed });
    },
  });
}

function receiver(deps: SyncDeps, onStatusChange: () => void) {
  return createBatcher<SessionEvent>({
    delayMs: EVENT_BATCH_MS,
    handle: (events) => {
      deps.store.saveEvents(deps.workspace.id, events);
      events.forEach((event) => {
        deps.hub.publish({ type: "event", event });
      });
      if (events.some((event) => STATUS_CHANGING.has(event.kind))) onStatusChange();
    },
  });
}

function relayEvents(client: RelayClient, onEvent: (event: SessionEvent) => void): void {
  client.onNotification(({ method, params }) => {
    if (method === RelayName.event) {
      onEvent(RelayNotifications[RelayName.event].parse(params).event);
    }
  });
}

/** Handshake, then resume every session after the last stored seq, and list the sessions. */
export async function startSyncSession(client: RelayClient, deps: SyncDeps): Promise<SyncSession> {
  const refresh = refresher(client, deps);
  const events = receiver(deps, refresh.request);
  relayEvents(client, events.add);
  const hello = await client.call(RelayName.hello, { clientVersion: CLIENT_VERSION });
  deps.store.upsertWorkspace({ ...deps.workspace, lastSeenAt: new Date().toISOString() });
  const afterSeq = deps.store.lastSeqs(deps.workspace.id);
  await client.call(RelayName.eventsSubscribe, { afterSeq });
  await refresh.runNow();
  return { hello, refreshSessions: refresh.runNow, flush: events.flush };
}
