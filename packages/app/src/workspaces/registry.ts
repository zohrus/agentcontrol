import type { ConnectionStatus, WorkspaceInfo } from "@agentcontrol/protocol";
import type { Store, Workspace } from "../store/index.ts";
import { type Hub, startSync, type Sync, type SyncOptions } from "../sync/index.ts";
import { type StatusWaiter, statusWaiter } from "./status-waiter.ts";

/** One workspace the app keeps a connection to. */
export interface Entry {
  workspace: Workspace;
  sync: Sync;
  waiter: StatusWaiter;
}

/** What a workspace looks like to the API: its record and where its connection stands. */
export function infoOf(workspace: Workspace, status: ConnectionStatus): WorkspaceInfo {
  const { id, label, kind, sshHost, lastSeenAt, removedAt } = workspace;
  const shown = removedAt === undefined ? status : { state: "removed" as const };
  return {
    id,
    label,
    kind,
    ...(sshHost === undefined ? {} : { sshHost }),
    ...(lastSeenAt === undefined ? {} : { lastSeenAt }),
    ...shown,
  };
}

/** What a sync needs besides what the registry supplies. */
export type SyncSettings = Omit<SyncOptions, "store" | "hub" | "workspace" | "onStatus">;

/** The live connections by workspace id; every change of state is pushed to the hub. */
export function createRegistry(parts: { store: Store; hub: Hub }) {
  const { store, hub } = parts;
  const entries = new Map<string, Entry>();
  const publish = (workspace: Workspace, status: ConnectionStatus): void => {
    const latest = store.listWorkspaces().find((known) => known.id === workspace.id);
    hub.publish({ type: "workspace", workspace: infoOf(latest ?? workspace, status) });
  };
  const start = (options: { workspace: Workspace; sync: SyncSettings }): Entry => {
    const { workspace } = options;
    const waiter = statusWaiter();
    const onStatus = (status: ConnectionStatus): void => {
      publish(workspace, status);
      waiter.notify(status);
    };
    const sync = startSync({ ...options.sync, store, hub, workspace, onStatus });
    const entry = { workspace, sync, waiter };
    entries.set(workspace.id, entry);
    return entry;
  };
  const statusOf = (id: string): ConnectionStatus =>
    entries.get(id)?.sync.status() ?? { state: "removed" };
  return {
    entries,
    start,
    publish,
    /** Every workspace in the store, with the state of its connection. */
    list: (): WorkspaceInfo[] =>
      store.listWorkspaces().map((workspace) => infoOf(workspace, statusOf(workspace.id))),
  };
}
