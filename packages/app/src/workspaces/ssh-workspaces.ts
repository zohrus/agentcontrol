import { VERSION, type WorkspaceInfo } from "@agentcontrol/protocol";
import { sshTarget, type WorkspaceTarget } from "../relays/index.ts";
import type { Store, Workspace } from "../store/index.ts";
import type { Hub } from "../sync/index.ts";
import { reported, reporterFor } from "./progress.ts";
import { checkSshWorkspace, hostSteps, relayStepOf } from "./ssh-check.ts";
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
  hub: Hub;
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

function targetFor(context: Context, workspace: Workspace): WorkspaceTarget {
  const { settings } = context;
  return sshTarget({
    host: workspace.sshHost ?? workspace.id,
    configFile: settings.configFile,
    version: VERSION,
    ...(settings.remoteRoot === undefined ? {} : { root: settings.remoteRoot }),
  });
}

/** Starts keeping an ssh workspace connected. */
function start(context: Context, workspace: Workspace): Entry {
  const { settings } = context;
  const target = context.targets.get(workspace.id) ?? targetFor(context, workspace);
  context.targets.set(workspace.id, target);
  return context.registry.start({
    workspace,
    sync: {
      connect: sshConnector({ target, relayBinaryFor: settings.relayBinaryFor }),
      replaceRelay: replaceOldRelay(target),
      backoffMaxMs: settings.backoffMaxMs ?? SSH_BACKOFF_MAX_MS,
    },
  });
}

/** Waits for the first connection of a new workspace, reporting it as the "Relay running" step. */
async function firstConnection(
  context: Context,
  call: { entry: Entry; id: string; request?: string },
) {
  const report = reporterFor({ hub: context.hub, requestId: call.request, workspaceId: call.id });
  await reported({
    report,
    begin: {
      id: "relay",
      label: "Relay running",
      message: "Starting the relay and connecting to it.",
    },
    work: async () => {
      await call.entry.waiter.next(FIRST_CONNECTION_WAIT_MS);
      return relayStepOf(infoNow(context, call.id));
    },
  });
}

async function addSsh(
  context: Context,
  options: { host: string; label?: string | undefined; requestId?: string | undefined },
): Promise<WorkspaceInfo> {
  const { host, label, requestId } = options;
  const id = `ssh-${crypto.randomUUID().slice(0, 8)}`;
  const workspace: Workspace = { id, label: label ?? host, kind: "ssh", sshHost: host };
  context.store.upsertWorkspace(workspace);
  const target = targetFor(context, workspace);
  context.targets.set(id, target);
  const report = reporterFor({ hub: context.hub, requestId, workspaceId: id });
  const { relayBinaryFor } = context.settings;
  const reached = await hostSteps({ target, relayBinaryFor, report });
  const entry = start(context, workspace);
  if (reached.ok)
    await firstConnection(context, { entry, id, ...(requestId && { request: requestId }) });
  else await entry.waiter.next(FIRST_CONNECTION_WAIT_MS);
  return infoNow(context, id);
}

async function remove(context: Context, id: string): Promise<WorkspaceInfo> {
  const entry = entryOf(context, id);
  await entry.sync.stop();
  context.registry.entries.delete(id);
  context.targets.delete(id);
  const removed = { ...entry.workspace, removedAt: new Date().toISOString() };
  context.store.upsertWorkspace(removed);
  context.registry.publish(removed, { state: "removed" });
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
    check: (id, options) =>
      checkSshWorkspace({
        entry: entryOf(context, id),
        target: targetOf(context, id),
        relayBinaryFor: context.settings.relayBinaryFor,
        report: reporterFor({ hub: context.hub, requestId: options?.requestId, workspaceId: id }),
      }),
  };
  return { start: (workspace: Workspace) => start(context, workspace), operations };
}
