import type { ConfigFileChange, ScopedItem } from "@agentcontrol/protocol";

/** Where a group of changes applies: everywhere (the agents' global files) or one repository. */
export type ReviewScope = { label: string; repoPath: string | undefined };

/** The repositories that have items, each once, in the order their first item is listed. */
export function reposOf(items: readonly ScopedItem[]): string[] {
  const repos = items.flatMap((scoped) => scoped.scope.repoPath ?? []);
  return [...new Set(repos)];
}

/** The repository whose folder holds the file, if any; the longest match wins for nested ones. */
export function repoOfPath(path: string, repos: readonly string[]): string | undefined {
  const holding = repos.filter((repo) => path.startsWith(`${repo}/`));
  return holding.toSorted((a, b) => b.length - a.length)[0];
}

const everywhere: ReviewScope = { label: "All repositories", repoPath: undefined };

/**
 * Every scope the review covers: the global files when an item is global or a change lands there,
 * then each repository that has items. A scope with nothing to write is still listed.
 */
export function scopesOf(call: {
  items: readonly ScopedItem[];
  changes: readonly ConfigFileChange[];
}): ReviewScope[] {
  const repos = reposOf(call.items);
  const hasGlobalItem = call.items.some((scoped) => scoped.scope.scope === "global");
  const hasGlobalChange = call.changes.some(
    (change) => repoOfPath(change.path, repos) === undefined,
  );
  const first = hasGlobalItem || hasGlobalChange ? [everywhere] : [];
  return [...first, ...repos.map((repoPath) => ({ label: `Only in ${repoPath}`, repoPath }))];
}
