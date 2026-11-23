import type { ConfigItem, ConfigPlan } from "@agentcontrol/protocol";

const SECRET = /\$\{secret:([A-Za-z0-9_.-]+)\}/g;

type Valued = { [K in ConfigItem["kind"]]?: (item: Extract<ConfigItem, { kind: K }>) => string[] };

const mcpValues = (item: Extract<ConfigItem, { kind: "mcp" }>): string[] => [
  ...[item.url ?? "", ...(item.args ?? [])],
  ...Object.values(item.env ?? {}),
  ...Object.values(item.headers ?? {}),
];

/** The texts of each kind of item that may hold a placeholder: server url, args, env, headers; hook command; env vars. */
const valuesOfKind: Valued = {
  mcp: mcpValues,
  hook: (item) => [item.command],
  env: (item) => Object.values(item.vars),
};

const valuesOf = (item: ConfigItem): string[] =>
  (valuesOfKind[item.kind] as ((item: ConfigItem) => string[]) | undefined)?.(item) ?? [];

/** `${secret:NAME}` placeholders stay in the files as written; resolving them is a later step. */
export function findSecrets(items: ConfigItem[]): ConfigPlan["needsSecret"] {
  const pairs = items.flatMap((item) =>
    valuesOf(item).map((value) => ({ itemId: item.id, value })),
  );
  return pairs.flatMap(({ itemId, value }) =>
    [...value.matchAll(SECRET)].map((m) => ({ itemId, secret: m[1] ?? "" })),
  );
}
