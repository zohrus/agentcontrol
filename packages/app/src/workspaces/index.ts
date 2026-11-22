import { VERSION } from "@agentcontrol/protocol";
import { type RelayClient, sshConfigHosts } from "../relays/index.ts";
import type { Store, Workspace } from "../store/index.ts";
import type { Hub, Link } from "../sync/index.ts";
import { checkThroughRelay } from "./check.ts";
import { createRegistry, type Entry } from "./registry.ts";
import { sshWorkspaces } from "./ssh-workspaces.ts";
import type { SshSettings, Workspaces } from "./types.ts";

export { relayBinariesIn } from "./relay-binaries.ts";
export type { SshSettings, Workspaces } from "./types.ts";

const LOCAL: Workspace = { id: "local", label: "This Mac", kind: "local" };

export interface WorkspacesOptions {
  store: Store;
  hub: Hub;
  /** Opens a fresh connection to the local relay; called again after every drop. */
  connectLocal: () => RelayClient;
  ssh: SshSettings;
}

const connectedLink = (entry: Entry | undefined): Link | undefined =>
  entry?.sync.status().state === "connected" ? entry.sync : undefined;

/**
 * Starts the local workspace and reconnects every ssh workspace saved earlier. Only the local one is
 * waited for (`ready`): an unreachable host never holds the app back.
 */
export function createWorkspaces(options: WorkspacesOptions): Workspaces {
  const { store, ssh } = options;
  const registry = createRegistry({ store, hub: options.hub });
  store.upsertWorkspace(LOCAL);
  const local = registry.start({
    workspace: LOCAL,
    sync: { version: VERSION, connect: options.connectLocal },
  });
  const remote = sshWorkspaces({ store, registry, settings: ssh });
  store
    .listWorkspaces()
    .filter((known) => known.kind === "ssh" && known.removedAt === undefined)
    .forEach(remote.start);
  return {
    ...remote.operations,
    localId: LOCAL.id,
    localLink: local.sync,
    list: registry.list,
    info: (id) => registry.list().find((known) => known.id === id),
    link: (id) => connectedLink(registry.entries.get(id)),
    check: (id) => (id === LOCAL.id ? checkThroughRelay(local.sync) : remote.operations.check(id)),
    hosts: () => sshConfigHosts(ssh.configFile),
    ready: () => local.sync.ready,
    stop: async () => {
      await Promise.all([...registry.entries.values()].map((entry) => entry.sync.stop()));
    },
  };
}
