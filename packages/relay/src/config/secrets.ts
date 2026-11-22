import type { ConfigItem, ConfigPlan } from "@agentcontrol/protocol";

const SECRET = /\$\{secret:([A-Za-z0-9_.-]+)\}/g;

function valuesOf(item: ConfigItem): string[] {
  if (item.kind === "mcp")
    return [...Object.values(item.env ?? {}), ...Object.values(item.headers ?? {})];
  return item.kind === "env" ? Object.values(item.vars) : [];
}

/** `${secret:NAME}` placeholders stay in the files as written; resolving them is a later step. */
export function findSecrets(items: ConfigItem[]): ConfigPlan["needsSecret"] {
  const pairs = items.flatMap((item) =>
    valuesOf(item).map((value) => ({ itemId: item.id, value })),
  );
  return pairs.flatMap(({ itemId, value }) =>
    [...value.matchAll(SECRET)].map((m) => ({ itemId, secret: m[1] ?? "" })),
  );
}
