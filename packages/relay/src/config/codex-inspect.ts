import { join } from "node:path";
import type { ConfigItem, McpItem, PermissionItem, ScopedItem } from "@agentcontrol/protocol";
import { hookItems } from "./hook-inspect.ts";
import { instructionItems, places, readJsonObject, scoped, skillItems } from "./inspect-shared.ts";
import {
  parseLines,
  parsePairs,
  parseString,
  parseStrings,
  serverNames,
  tableBody,
  topValue,
} from "./toml-read.ts";
import type { ConfigCtx, Place } from "./types.ts";

const AGENT = "codex";
const nonEmpty = <T extends object>(v: T): T | undefined =>
  Object.keys(v).length > 0 ? v : undefined;

function mcpItems(toml: string): McpItem[] {
  return serverNames(toml).map((name) => {
    const rows = parseLines(tableBody(toml, `mcp_servers.${name}`));
    const args = parseStrings(rows.args);
    const sub = parsePairs(tableBody(toml, `mcp_servers.${name}.env`) ?? "");
    return {
      id: `${AGENT}:mcp:${name}`,
      kind: "mcp",
      name,
      command: parseString(rows.command),
      args: args.length > 0 ? args : undefined,
      url: parseString(rows.url),
      env: nonEmpty({ ...parsePairs(rows.env ?? ""), ...sub }),
      headers: nonEmpty(parsePairs(rows.http_headers ?? "")),
    };
  });
}

const MODE_BY_SANDBOX = {
  "read-only": "ask",
  "workspace-write": "auto-edit",
  "danger-full-access": "full-auto",
} as const;

function permissionItem(toml: string): PermissionItem | undefined {
  const sandbox = parseString(topValue(toml, "sandbox_mode")) ?? "";
  const mode =
    sandbox in MODE_BY_SANDBOX
      ? MODE_BY_SANDBOX[sandbox as keyof typeof MODE_BY_SANDBOX]
      : undefined;
  return mode
    ? { id: `${AGENT}:permission`, kind: "permission", allow: [], deny: [], mode }
    : undefined;
}

function configItems(toml: string): ConfigItem[] {
  const vars = parsePairs(tableBody(toml, "shell_environment_policy.set") ?? "");
  const env: ConfigItem[] = nonEmpty(vars) ? [{ id: `${AGENT}:env`, kind: "env", vars }] : [];
  const permission = permissionItem(toml);
  return [...mcpItems(toml), ...(permission ? [permission] : []), ...env];
}

async function inspectPlace(ctx: ConfigCtx, place: Place): Promise<ScopedItem[]> {
  const codex = join(place.base, ".codex");
  const [toml, hooks, md] = await Promise.all([
    ctx.readFile(join(codex, "config.toml")),
    readJsonObject(ctx, join(codex, "hooks.json")),
    ctx.readFile(place.global ? join(codex, "AGENTS.md") : join(place.base, "AGENTS.md")),
  ]);
  const plain = [...configItems(toml ?? ""), ...hookItems(AGENT, hooks)];
  const args = { agent: AGENT, place, ctx } as const;
  return [
    ...plain.map((i) => scoped(i, place, ctx)),
    ...instructionItems({ ...args, content: md }),
    ...(await skillItems({ ...args, dir: join(place.base, ".agents", "skills") })),
  ];
}

export async function inspectCodex(ctx: ConfigCtx): Promise<ScopedItem[]> {
  const found = await Promise.all(places(ctx).map((p) => inspectPlace(ctx, p)));
  return found.flat();
}
