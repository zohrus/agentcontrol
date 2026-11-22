import type { ConnectionState, Hub, WorkspaceConnection } from "./hub.ts";

/** Holds the connection state of one workspace and tells the hub whenever it changes. */
export function createConnectionState(target: { hub: Hub; workspaceId: string }) {
  let current: WorkspaceConnection = { workspaceId: target.workspaceId, state: "disconnected" };
  return {
    get: (): WorkspaceConnection => current,
    set: (state: ConnectionState): void => {
      if (current.state === state) return;
      current = { ...current, state };
      target.hub.publish({ type: "workspace", connection: current });
    },
  };
}
