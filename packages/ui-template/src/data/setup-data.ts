import type { RepoId, RepoSetup } from "@agentcontrol/sdk";
import type { Context } from "./context.ts";

/** Loads the repositories and the agents the new-session and setup dialogs offer. */
export async function loadChoices(ctx: Context): Promise<void> {
  const [repos, agents] = await Promise.all([ctx.client.repos.list(), ctx.client.agents.list()]);
  ctx.store.update((s) => ({ ...s, repos, agents }));
}

/** Registers the folder and returns the repository's own path (its top folder). */
export async function addRepository(ctx: Context, path: string): Promise<string> {
  const repo = await ctx.client.repos.add(path);
  await loadChoices(ctx);
  return repo.path;
}

export async function saveSetup(
  ctx: Context,
  call: { repoId: RepoId; setup: RepoSetup },
): Promise<void> {
  await ctx.client.repos.setSetup(call.repoId, call.setup);
  await loadChoices(ctx);
}

/** Runs the workspace health checklist; `checking` is true meanwhile. */
export async function checkWorkspace(ctx: Context): Promise<void> {
  ctx.store.update((s) => ({ ...s, checking: true }));
  try {
    const checks = await ctx.client.workspace.check();
    ctx.store.update((s) => ({ ...s, checks }));
  } finally {
    ctx.store.update((s) => ({ ...s, checking: false }));
  }
}
