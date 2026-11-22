import type { ConfigItem, ScopedItem } from "@agentcontrol/sdk";

/** Builders for the canonical items a user sets up once in the app. */

const everywhere = { scope: "global" } as const;
type Of<K extends ConfigItem["kind"]> = Extract<ConfigItem, { kind: K }>;

const global = (item: ConfigItem): ScopedItem => ({ item, scope: everywhere, enabled: true });

export function mcpServer(input: Omit<Of<"mcp">, "id" | "kind">): ScopedItem {
  return global({ id: `mcp-${input.name.replaceAll(" ", "-")}`, kind: "mcp", ...input });
}

export function instructions(input: { id: string; text: string }): ScopedItem {
  return global({ ...input, kind: "instructions", name: input.id });
}

export function permissionRule(input: Omit<Of<"permission">, "id" | "kind">): ScopedItem {
  return global({ id: "rules", kind: "permission", ...input });
}

export function afterEditHook(input: { id: string; command: string }): ScopedItem {
  return global({ ...input, kind: "hook", name: input.id, event: "after-edit" });
}

export function beforeToolHook(input: { id: string; command: string }): ScopedItem {
  return global({ ...input, kind: "hook", name: input.id, event: "before-tool" });
}

export function skill(input: { name: string; text: string; path?: string }): ScopedItem {
  const files = [{ path: input.path ?? "SKILL.md", content: input.text }];
  return global({ id: `skill-${input.name}`, kind: "skill", name: input.name, files });
}

export function command(input: { name: string; prompt: string; description?: string }): ScopedItem {
  return global({ id: `command-${input.name}`, kind: "command", ...input });
}

export function environment(vars: Record<string, string>): ScopedItem {
  return global({ id: "env", kind: "env", vars });
}

/** The same item, but only for one repository. */
export function onlyInRepo(scoped: ScopedItem, repoPath: string): ScopedItem {
  return { ...scoped, scope: { scope: "repo", repoPath } };
}

/** The same item, scoped to a repository that was never named. */
export function inUnnamedRepo(scoped: ScopedItem): ScopedItem {
  return { ...scoped, scope: { scope: "repo" } };
}

/** The same item, switched off. */
export function switchedOff(scoped: ScopedItem): ScopedItem {
  return { ...scoped, enabled: false };
}

/** The same items, with the user's hand-written notes (the instructions that have no marker) rewritten. */
export function withNotesRewritten(items: ScopedItem[], text: string): ScopedItem[] {
  return items.map((scoped) =>
    scoped.item.kind === "instructions" && scoped.item.handWritten === true
      ? { ...scoped, item: { ...scoped.item, text } }
      : scoped,
  );
}
