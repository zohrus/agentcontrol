import { RelayName, type SessionId } from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";
import type { Store } from "../store/index.ts";

interface Target {
  client: RelayClient;
  store: Store;
  workspaceId: string;
}

/** The work waiting on each relay connection, so reads of usage finish in the order they began. */
const lines = new WeakMap<RelayClient, Promise<unknown>>();

/** Runs `work` after every earlier piece of usage work on the same connection, whatever its outcome. */
function inOrder(client: RelayClient, work: () => Promise<void>): Promise<void> {
  const next = (lines.get(client) ?? Promise.resolve()).then(work, work);
  lines.set(client, next);
  return next;
}

/**
 * Saves the usage rows of these sessions, as the relay works them out from their logs, in place of
 * what was saved before. The relay reads the whole log each time, so asking again at any moment
 * gives the same rows and nothing is counted twice. Reads run one after the other, so an older
 * answer never replaces a newer one; a session the relay cannot answer for is skipped.
 */
export function saveUsageOf(target: Target, sessionIds: SessionId[]): Promise<void> {
  return inOrder(target.client, async () => {
    for (const sessionId of sessionIds) {
      const answer = await target.client
        .call(RelayName.usage, { sessionId })
        .catch(() => undefined);
      if (answer === undefined) continue;
      const { workspaceId, store } = target;
      store.replaceUsage({ workspaceId, sessionIds: [sessionId], rows: answer.rows });
    }
  });
}

/** Saves the usage of every session the app knows of in this workspace, with one request. */
export function saveUsageOfAll(target: Target): Promise<void> {
  return inOrder(target.client, async () => {
    const { rows } = await target.client.call(RelayName.usage, {});
    const { workspaceId, store } = target;
    const known = store.listSessions().filter((session) => session.workspaceId === workspaceId);
    const sessionIds = [
      ...new Set([...rows.map((row) => row.sessionId), ...known.map((s) => s.id)]),
    ];
    store.replaceUsage({ workspaceId, sessionIds, rows });
  });
}
