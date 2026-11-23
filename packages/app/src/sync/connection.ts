import { VERSION } from "@agentcontrol/protocol";
import type { ConnectionState, Hub, WorkspaceConnection } from "./hub.ts";

/** What the app made of the relay that answered: the right version, or one that needs updating. */
export function stateOfRelayVersion(relayVersion: string): ConnectionState {
  return relayVersion === VERSION ? "connected" : "needs-relay-update";
}

/** Holds the connection state of one workspace and tells the hub whenever it changes. */
export function createConnectionState(target: { hub: Hub; workspaceId: string }) {
  let current: WorkspaceConnection = { workspaceId: target.workspaceId, state: "disconnected" };
  return {
    get: (): WorkspaceConnection => current,
    set: (state: ConnectionState, relayVersion?: string): void => {
      const next = {
        workspaceId: target.workspaceId,
        state,
        ...(relayVersion === undefined ? {} : { relayVersion }),
      };
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      current = next;
      target.hub.publish({ type: "workspace", connection: current });
    },
  };
}
