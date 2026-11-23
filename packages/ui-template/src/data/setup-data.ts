import type { RepoId, RepoSetup } from "@agentcontrol/sdk";
import type { Context } from "./context.ts";
import { LOCAL_WORKSPACE } from "./session-ref.ts";

/** A call about one workspace; the local one when left out. */
type In = { workspaceId?: string };

/** Loads the repositories and the agents the new-session and setup dialogs offer for a workspace. */
export async function loadChoices(ctx: Context, workspaceId = LOCAL_WORKSPACE): Promise<void> {
  const options = { workspaceId };
  const [repos, agents] = await Promise.all([
    ctx.client.repos.list(options),
    ctx.client.agents.list(options),
  ]);
  ctx.store.update((s) => ({ ...s, choices: { ...s.choices, [workspaceId]: { repos, agents } } }));
}

/** Registers the folder and returns the repository's own path (its top folder). */
export async function addRepository(ctx: Context, call: In & { path: string }): Promise<string> {
  const workspaceId = call.workspaceId ?? LOCAL_WORKSPACE;
  const repo = await ctx.client.repos.add(call.path, { workspaceId });
  await loadChoices(ctx, workspaceId);
  return repo.path;
}

export async function saveSetup(
  ctx: Context,
  call: In & { repoId: RepoId; setup: RepoSetup },
): Promise<void> {
  const workspaceId = call.workspaceId ?? LOCAL_WORKSPACE;
  await ctx.client.repos.setSetup(call.repoId, call.setup, { workspaceId });
  await loadChoices(ctx, workspaceId);
}
