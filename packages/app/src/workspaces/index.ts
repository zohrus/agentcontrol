import { type RelayClient, sshConfigHosts } from "../relays/index.ts";
import type { Store, Workspace } from "../store/index.ts";
import type { Hub, Link } from "../sync/index.ts";
import { operationsOf } from "./local-operations.ts";
import { createRegistry, type Entry } from "./registry.ts";
import { replaceOldRelay } from "./ssh-connect.ts";
import { sshWorkspaces } from "./ssh-workspaces.ts";
import type { SshSettings, Workspaces } from "./types.ts";

export { relayBinariesIn, shippedRelayBinaries } from "./relay-binaries.ts";
export type { SshSettings, Workspaces } from "./types.ts";

const LOCAL: Workspace = { id: "local", label: "This Mac", kind: "local" };

export interface WorkspacesOptions {
  store: Store;
  hub: Hub;
  /** Opens a fresh connection to the local relay; called again after every drop. */
  connectLocal: () => RelayClient;
  /** Stops the local relay daemon, so that one of the app's version can replace an old one. */
  stopLocalRelay?: () => Promise<void>;
  ssh: SshSettings;
}

const USABLE = new Set(["connected", "needs-relay-update"]);

/** The link of a workspace whose relay answers; an outdated one is used as it is. */
const usableLink = (entry: Entry | undefined): Link | undefined =>
  entry && USABLE.has(entry.sync.status().state) ? entry.sync : undefined;

function startLocal(registry: ReturnType<typeof createRegistry>, options: WorkspacesOptions) {
  const { stopLocalRelay } = options;
  const replaceRelay = stopLocalRelay && replaceOldRelay({ stopRelay: stopLocalRelay });
  return registry.start({
    workspace: LOCAL,
    sync: { connect: options.connectLocal, ...(replaceRelay && { replaceRelay }) },
  });
}

/**
 * Starts the local workspace and reconnects every ssh workspace saved earlier. All
 * connections happen in the background: an unreachable relay or host never holds the app back.
 */
export function createWorkspaces(options: WorkspacesOptions): Workspaces {
  const { store, ssh } = options;
  const registry = createRegistry({ store, hub: options.hub });
  store.upsertWorkspace(LOCAL);
  const local = startLocal(registry, options);
  const remote = sshWorkspaces({ store, hub: options.hub, registry, settings: ssh });
  store
    .listWorkspaces()
    .filter((known) => known.kind === "ssh" && known.removedAt === undefined)
    .forEach(remote.start);
  return {
    ...remote.operations,
    ...operationsOf({
      local,
      hub: options.hub,
      list: registry.list,
      stopLocalRelay: options.stopLocalRelay,
      remote: remote.operations,
    }),
    localId: LOCAL.id,
    localLink: local.sync,
    list: registry.list,
    info: (id) => registry.list().find((known) => known.id === id),
    link: (id) => usableLink(registry.entries.get(id)),
    hosts: () => sshConfigHosts(ssh.configFile),
    stop: async () => {
      await Promise.all([...registry.entries.values()].map((entry) => entry.sync.stop()));
    },
  };
}
