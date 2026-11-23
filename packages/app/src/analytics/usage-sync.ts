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

/** Says in the app's log that usage could not be read; the next turn or connection reads it again. */
function reportUnread(what: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Could not read the usage of ${what}: ${reason}`);
}

/**
 * Saves the usage rows of these sessions, as the relay works them out from their logs, in place of
 * what was saved before. The relay reads the whole log each time, so asking again at any moment
 * gives the same rows and nothing is counted twice. Reads run one after the other, so an older
 * answer never replaces a newer one; a session the relay cannot answer for is skipped, and the
 * failure is logged. Never rejects.
 */
export function saveUsageOf(target: Target, sessionIds: SessionId[]): Promise<void> {
  return inOrder(target.client, async () => {
    for (const sessionId of sessionIds) {
      const { workspaceId, store } = target;
      try {
        const answer = await target.client.call(RelayName.usage, { sessionId });
        store.replaceUsage({ workspaceId, sessionIds: [sessionId], rows: answer.rows });
      } catch (error) {
        reportUnread(`session ${sessionId}`, error);
      }
    }
  });
}

/** Saves the usage of every session the app knows of in this workspace, with one request. Never rejects. */
export function saveUsageOfAll(target: Target): Promise<void> {
  return inOrder(target.client, async () => {
    try {
      const { rows } = await target.client.call(RelayName.usage, {});
      const { workspaceId, store } = target;
      const known = store.listSessions().filter((session) => session.workspaceId === workspaceId);
      const sessionIds = [
        ...new Set([...rows.map((row) => row.sessionId), ...known.map((s) => s.id)]),
      ];
      store.replaceUsage({ workspaceId, sessionIds, rows });
    } catch (error) {
      reportUnread(`workspace ${target.workspaceId}`, error);
    }
  });
}
