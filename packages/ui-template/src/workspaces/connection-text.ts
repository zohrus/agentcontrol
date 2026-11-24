import type { ConnectionState } from "@agentcontrol/protocol";

/** What the connection of a workspace is called in the UI. */
const names: Record<ConnectionState, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  offline: "Offline",
  "needs-relay-update": "Needs relay update",
  removed: "Removed",
};

/** What to tell the user when the app gives no reason of its own. */
const explanations: Partial<Record<ConnectionState, string>> = {
  connecting: "AgentControl is reaching this machine.",
  reconnecting:
    "The connection dropped. Agents keep running on the machine and AgentControl is trying again.",
  offline: "AgentControl cannot reach this machine. It keeps trying.",
  "needs-relay-update":
    "Its relay is not the app's own and still has sessions working. Restart it when they are done.",
  removed: "This workspace was removed. Its past sessions stay readable.",
};

type Connection = { state: ConnectionState; reason?: string | undefined };

/** "Connected", "Offline", "Needs relay update": the short name of the connection. */
export const connectionName = ({ state }: Connection): string => names[state];

/** Why the workspace is not fully connected, in plain words; nothing while it is connected. */
export function connectionDetail({ state, reason }: Connection): string | undefined {
  return reason ?? explanations[state];
}

/** True when sessions of this workspace can be sent commands (it has a working relay). */
export const canTakeCommands = ({ state }: Connection): boolean =>
  state === "connected" || state === "needs-relay-update";

/** Why the sessions of this workspace can only be read, or nothing when they can be used. */
export function readOnlyNote(workspace: Connection & { label: string }): string | undefined {
  if (canTakeCommands(workspace)) return undefined;
  const state = connectionName(workspace).toLowerCase().replace("…", "");
  const why = connectionDetail(workspace) ?? "";
  return `The workspace "${workspace.label}" is ${state}, so this session is read-only. ${why}`.trim();
}
