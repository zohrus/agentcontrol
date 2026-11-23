import type { SessionEvent } from "@agentcontrol/protocol";
import { saveUsageOf, saveUsageOfAll } from "../analytics/index.ts";
import type { RelayClient } from "../relays/index.ts";
import type { SyncDeps } from "./deps.ts";

/**
 * Keeps the saved usage rows up to date for analytics: a finished turn is the moment its tokens and
 * cost are known, so the sessions that just ended a turn are read again from the relay. A relay that
 * cannot answer now is not an error (it is logged): the next turn, or the next connection, reads it again.
 */
export function usageAfterTurns(call: {
  client: RelayClient;
  deps: SyncDeps;
}): (events: SessionEvent[]) => void {
  const { client, deps } = call;
  const target = { client, store: deps.store, workspaceId: deps.workspace.id };
  return (events) => {
    const ended = events.filter((event) => event.kind === "turn-ended");
    const sessionIds = [...new Set(ended.map((event) => event.sessionId))];
    if (sessionIds.length > 0) void saveUsageOf(target, sessionIds);
  };
}

/** Reads the usage of every session once per connection, for sessions the app has not seen end a turn. */
export function saveAllUsage(call: { client: RelayClient; deps: SyncDeps }): void {
  const { client, deps } = call;
  const target = { client, store: deps.store, workspaceId: deps.workspace.id };
  void saveUsageOfAll(target);
}
