import type { CheckStep, WorkspaceInfo } from "@agentcontrol/sdk";
import { attempt, type Context, inBackground, succeeded } from "./context.ts";
import { describeError } from "./errors.ts";
import { LOCAL_WORKSPACE } from "./session-ref.ts";
import type { WorkspaceCheck } from "./model.ts";
import { loadChoices } from "./setup-data.ts";

/** Puts a workspace into the list, replacing the one with its id; "This Mac" stays first. */
function withWorkspace(have: readonly WorkspaceInfo[], info: WorkspaceInfo): WorkspaceInfo[] {
  const all = [...have.filter((known) => known.id !== info.id), info];
  return all.toSorted(
    (a, b) => Number(b.id === LOCAL_WORKSPACE) - Number(a.id === LOCAL_WORKSPACE),
  );
}

/** A workspace changed state (live) or was answered by an action: show it. */
export function applyWorkspace(ctx: Context, info: WorkspaceInfo): void {
  ctx.store.update((s) => ({ ...s, workspaces: withWorkspace(s.workspaces, info) }));
  if (info.state === "connected") inBackground(ctx, loadChoices(ctx, info.id));
}

/** Every workspace the app knows, after a (re)connect. */
export async function loadWorkspaces(ctx: Context): Promise<void> {
  const workspaces = await ctx.client.workspaces.list();
  ctx.store.update((s) => ({ ...s, workspaces }));
}

function holdCheck(ctx: Context, id: string, check: WorkspaceCheck): void {
  ctx.store.update((s) => ({ ...s, checks: { ...s.checks, [id]: check } }));
}

const stepsOf = (ctx: Context, id: string): Promise<CheckStep[]> =>
  id === LOCAL_WORKSPACE ? ctx.client.workspace.check() : ctx.client.workspaces.check(id);

/** Runs the workspace's checklist (and repairs what it can); `running` is true meanwhile. */
async function checkWorkspace(ctx: Context, id: string): Promise<void> {
  const before = ctx.store.get().checks[id]?.steps ?? [];
  holdCheck(ctx, id, { steps: before, running: true });
  try {
    holdCheck(ctx, id, { steps: await stepsOf(ctx, id), running: false });
  } catch (error) {
    holdCheck(ctx, id, { steps: before, running: false });
    throw error;
  }
}

/** What adding a workspace came to: the workspace, or the reason it was refused. */
export type AddOutcome = { workspace: WorkspaceInfo } | { refusal: string };

/** Adds an ssh workspace; a refusal (bad host, already added, no answer) comes back as text for the form. */
async function addWorkspace(
  ctx: Context,
  call: { host: string; label?: string },
): Promise<AddOutcome> {
  try {
    const workspace = await ctx.client.workspaces.add({ kind: "ssh", ...call });
    applyWorkspace(ctx, workspace);
    return { workspace };
  } catch (error) {
    return { refusal: describeError(error) };
  }
}

/** The host aliases of the user's ssh config; none when they cannot be read. */
async function listHosts(ctx: Context): Promise<string[]> {
  return (await attempt(ctx, () => ctx.client.workspaces.hosts())) ?? [];
}

/** Removes a workspace; its sessions stay readable. */
async function removeWorkspace(ctx: Context, id: string): Promise<void> {
  applyWorkspace(ctx, await ctx.client.workspaces.remove(id));
}

/** Replaces the relay of a workspace with the app's version. */
async function restartRelay(ctx: Context, id: string): Promise<void> {
  applyWorkspace(ctx, await ctx.client.workspaces.restartRelay(id));
}

/** What the user can do about workspaces; each reports a failure itself. */
export function workspaceActions(ctx: Context) {
  return {
    add: (call: { host: string; label?: string }) => addWorkspace(ctx, call),
    hosts: () => listHosts(ctx),
    check: (id: string) => succeeded(ctx, () => checkWorkspace(ctx, id)),
    remove: (id: string) => succeeded(ctx, () => removeWorkspace(ctx, id)),
    restartRelay: (id: string) => succeeded(ctx, () => restartRelay(ctx, id)),
    loadChoices: (id: string) => attempt(ctx, () => loadChoices(ctx, id)),
  };
}
