import { VERSION, type WorkspaceInfo } from "@agentcontrol/protocol";
import { sshTarget, type WorkspaceTarget } from "../relays/index.ts";
import type { Store, Workspace } from "../store/index.ts";
import { checkSshWorkspace } from "./ssh-check.ts";
import type { createRegistry, Entry } from "./registry.ts";
import { infoOf } from "./registry.ts";
import { replaceOldRelay, sshConnector } from "./ssh-connect.ts";
import type { SshSettings, Workspaces } from "./types.ts";

type Registry = ReturnType<typeof createRegistry>;

const FIRST_CONNECTION_WAIT_MS = 30_000;
const SSH_BACKOFF_MAX_MS = 15_000;

type SshOperations = Pick<Workspaces, "addSsh" | "remove" | "check" | "restartRelay">;

interface Context {
  store: Store;
  registry: Registry;
  settings: SshSettings;
  targets: Map<string, WorkspaceTarget>;
}

function targetOf(context: Context, id: string): WorkspaceTarget {
  const target = context.targets.get(id);
  if (!target) throw new Error(`No ssh workspace ${id}.`);
  return target;
}

function entryOf(context: Context, id: string): Entry {
  const entry = context.registry.entries.get(id);
  if (!entry) throw new Error(`No connected workspace ${id}.`);
  return entry;
}

function infoNow(context: Context, id: string): WorkspaceInfo {
  const found = context.registry.list().find((info) => info.id === id);
  if (!found) throw new Error(`No workspace ${id}.`);
  return found;
}

/** Starts keeping an ssh workspace connected. */
function start(context: Context, workspace: Workspace): Entry {
  const { settings } = context;
  const target = sshTarget({
    host: workspace.sshHost ?? workspace.id,
    configFile: settings.configFile,
    version: VERSION,
    ...(settings.remoteRoot === undefined ? {} : { root: settings.remoteRoot }),
  });
  context.targets.set(workspace.id, target);
  return context.registry.start({
    workspace,
    sync: {
      version: VERSION,
      connect: sshConnector({ target, relayBinaryFor: settings.relayBinaryFor }),
      replaceRelay: replaceOldRelay(target),
      backoffMaxMs: settings.backoffMaxMs ?? SSH_BACKOFF_MAX_MS,
    },
  });
}

async function addSsh(
  context: Context,
  options: { host: string; label?: string | undefined },
): Promise<WorkspaceInfo> {
  const { host, label } = options;
  const id = `ssh-${crypto.randomUUID().slice(0, 8)}`;
  const workspace: Workspace = { id, label: label ?? host, kind: "ssh", sshHost: host };
  context.store.upsertWorkspace(workspace);
  const entry = start(context, workspace);
  await entry.waiter.next(FIRST_CONNECTION_WAIT_MS);
  return infoNow(context, id);
}

async function remove(context: Context, id: string): Promise<WorkspaceInfo> {
  const entry = entryOf(context, id);
  await entry.sync.stop();
  context.registry.entries.delete(id);
  const removed = { ...entry.workspace, removedAt: new Date().toISOString() };
  context.store.upsertWorkspace(removed);
  return infoOf(removed, { state: "removed" });
}

async function restartRelay(context: Context, id: string): Promise<WorkspaceInfo> {
  await targetOf(context, id).stopRelay();
  entryOf(context, id).sync.retryNow();
  return infoNow(context, id);
}

/** What the app does with the ssh workspaces: start their connections, and the actions on them. */
export function sshWorkspaces(parts: Omit<Context, "targets">) {
  const context: Context = { ...parts, targets: new Map() };
  const operations: SshOperations = {
    addSsh: (options) => addSsh(context, options),
    remove: (id) => remove(context, id),
    restartRelay: (id) => restartRelay(context, id),
    check: (id) =>
      checkSshWorkspace({
        entry: entryOf(context, id),
        target: targetOf(context, id),
        relayBinaryFor: context.settings.relayBinaryFor,
      }),
  };
  return { start: (workspace: Workspace) => start(context, workspace), operations };
}
