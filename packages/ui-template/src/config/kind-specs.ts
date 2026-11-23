import type { ConfigItem, ScopedItem } from "@agentcontrol/protocol";
import { slug } from "./form-text.ts";
import type { Kind, KindSpec } from "./kind-spec.ts";
import { commandSpec, skillSpec } from "./specs-files.ts";
import { envSpec, hookSpec } from "./specs-hooks.ts";
import { mcpSpec } from "./specs-servers.ts";
import { instructionsSpec, permissionSpec } from "./specs-text.ts";

/** The tabs of the Config screen, in order, each with how its items are edited. */
export const kindOrder: readonly Kind[] = [
  "mcp",
  "instructions",
  "permission",
  "hook",
  "skill",
  "command",
  "env",
];

export const kindSpecs: Record<Kind, KindSpec> = {
  mcp: mcpSpec,
  instructions: instructionsSpec,
  permission: permissionSpec,
  hook: hookSpec,
  skill: skillSpec,
  command: commandSpec,
  env: envSpec,
};

/** The items of one kind. */
export const ofKind = (items: readonly ScopedItem[], kind: Kind): ScopedItem[] =>
  items.filter((scoped) => scoped.item.kind === kind);

/** A name for an item no other item has: `mcp-docs`, then `mcp-docs-2`. */
export function newId(item: ConfigItem, taken: ReadonlySet<string>): string {
  const name = "name" in item ? slug(item.name) : "";
  const base = name === "" ? item.kind : `${item.kind}-${name}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${String(n)}`;
  return id;
}
