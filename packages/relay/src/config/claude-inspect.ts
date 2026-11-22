import { join } from "node:path";
import type { ConfigItem, McpItem, ScopedItem } from "@agentcontrol/protocol";
import { hookItems } from "./hook-inspect.ts";
import {
  asRecord,
  asStringMap,
  asStrings,
  asText,
  type Obj,
  commandItems,
  instructionItems,
  places,
  readJsonObject,
  scoped,
  skillItems,
} from "./inspect-shared.ts";
import type { ConfigCtx, Place } from "./types.ts";

const AGENT = "claude-code";
const MODES: Record<string, "ask" | "auto-edit" | "full-auto"> = {
  default: "ask",
  acceptEdits: "auto-edit",
  bypassPermissions: "full-auto",
};

const optMap = (v: unknown): Record<string, string> | undefined =>
  v === undefined ? undefined : asStringMap(v);

function mcpItems(file: Obj): McpItem[] {
  return Object.entries(asRecord(file.mcpServers)).map(([name, raw]) => {
    const s = asRecord(raw);
    const args = asStrings(s.args);
    return {
      id: `${AGENT}:mcp:${name}`,
      kind: "mcp",
      name,
      command: asText(s.command),
      args: args.length > 0 ? args : undefined,
      url: asText(s.url),
      env: optMap(s.env),
      headers: optMap(s.headers),
    };
  });
}

function settingsItems(settings: Obj): ConfigItem[] {
  const perms = asRecord(settings.permissions);
  const allow = asStrings(perms.allow);
  const deny = asStrings(perms.deny);
  const mode = MODES[asText(perms.defaultMode) ?? ""];
  const vars = asStringMap(settings.env);
  const items: ConfigItem[] = hookItems(AGENT, settings);
  if (allow.length + deny.length > 0 || mode) {
    items.push({ id: `${AGENT}:permission`, kind: "permission", allow, deny, mode });
  }
  if (Object.keys(vars).length > 0) items.push({ id: `${AGENT}:env`, kind: "env", vars });
  return items;
}

async function inspectPlace(ctx: ConfigCtx, place: Place): Promise<ScopedItem[]> {
  const mcpFile = place.global ? ".claude.json" : ".mcp.json";
  const base = join(place.base, ".claude");
  const [mcp, settings, md] = await Promise.all([
    readJsonObject(ctx, join(place.base, mcpFile)),
    readJsonObject(ctx, join(base, "settings.json")),
    ctx.readFile(place.global ? join(base, "CLAUDE.md") : join(place.base, "CLAUDE.md")),
  ]);
  const plain = [...mcpItems(mcp), ...settingsItems(settings)].map((i) => scoped(i, place, ctx));
  const args = { agent: AGENT, place, ctx } as const;
  return [
    ...plain,
    ...instructionItems({ ...args, content: md }),
    ...(await skillItems({ ...args, dir: join(base, "skills") })),
    ...(await commandItems({ ...args, dir: join(base, "commands") })),
  ];
}

export async function inspectClaude(ctx: ConfigCtx): Promise<ScopedItem[]> {
  const found = await Promise.all(places(ctx).map((p) => inspectPlace(ctx, p)));
  return found.flat();
}
