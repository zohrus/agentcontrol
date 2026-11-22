import { join } from "node:path";
import type { EnvItem, HookItem, McpItem, PermissionItem } from "@agentcontrol/protocol";
import { makeAdapter } from "./adapter.ts";
import { inspectCodex } from "./codex-inspect.ts";
import {
  forKind,
  hookEntry,
  instructionsEntry,
  isSafeName,
  isSafeVar,
  skillEntries,
  unsupported,
} from "./entries.ts";
import type { Entry, Mapped, Place } from "./types.ts";

const EVENTS = {
  "before-tool": "PreToolUse",
  "after-edit": "PostToolUse",
  "session-start": "SessionStart",
  "session-stop": "Stop",
} as const;
const MODES = {
  ask: { approval_policy: "on-request", sandbox_mode: "read-only" },
  "auto-edit": { approval_policy: "on-request", sandbox_mode: "workspace-write" },
  "full-auto": { approval_policy: "never", sandbox_mode: "danger-full-access" },
} as const;

const configFile = (place: Place): string => join(place.base, ".codex", "config.toml");
const str = (text: string): string => JSON.stringify(text);
const bare = (key: string): string => (isSafeVar(key) ? key : str(key));
const inline = (map: Record<string, string>): string =>
  `{ ${Object.entries(map)
    .map(([k, v]) => `${bare(k)} = ${str(v)}`)
    .join(", ")} }`;

function toml(input: { place: Place; itemId: string; key: string; value: string }): Entry {
  const { place, itemId, key, value } = input;
  return { file: configFile(place), format: "toml", key, itemId, value };
}

const line = (name: string, value: string | undefined): string[] =>
  value === undefined ? [] : [`${name} = ${value}`];
const tomlMap = (map: Record<string, string> | undefined): string | undefined =>
  map && Object.keys(map).length > 0 ? inline(map) : undefined;
const tomlList = (list: string[] | undefined): string | undefined =>
  list?.length ? `[${list.map(str).join(", ")}]` : undefined;

function serverLines(item: McpItem): string[] {
  const head = item.url ? line("url", str(item.url)) : line("command", str(item.command ?? ""));
  return [
    ...head,
    ...line("args", tomlList(item.args)),
    ...line("env", tomlMap(item.env)),
    ...line("http_headers", tomlMap(item.headers)),
  ];
}

function mcp(item: McpItem, place: Place): Mapped {
  if (!isSafeName(item.name)) return unsupported(`"${item.name}" is not a valid MCP server name`);
  if (!item.url && !item.command) return unsupported("an MCP server needs a command or a url");
  const key = `table:mcp_servers.${item.name}`;
  return {
    entries: [toml({ place, itemId: item.id, key, value: serverLines(item).join("\n") })],
    unsupported: [],
  };
}

function permission(item: PermissionItem, place: Place): Mapped {
  const mode = item.mode ? MODES[item.mode] : undefined;
  const entries = Object.entries(mode ?? {}).map(([name, value]) =>
    toml({ place, itemId: item.id, key: `key:${name}`, value: str(value) }),
  );
  const rules = item.allow.length + item.deny.length > 0;
  const reason =
    "Codex config.toml has no allow or deny list, only the approval policy and sandbox mode; its command rules use a different format that is not written yet";
  return { entries, unsupported: rules ? [reason] : [] };
}

function env(item: EnvItem, place: Place): Mapped {
  const names = Object.keys(item.vars);
  const lines = names.filter(isSafeVar).map((n) => `${n} = ${str(item.vars[n] ?? "")}`);
  const key = "table:shell_environment_policy.set";
  const bad = names.filter((n) => !isSafeVar(n)).map((n) => `"${n}" is not a valid variable name`);
  const entries =
    lines.length > 0 ? [toml({ place, itemId: item.id, key, value: lines.join("\n") })] : [];
  return { entries, unsupported: bad };
}

function hook(item: HookItem, place: Place): Mapped {
  const base = { item, file: join(place.base, ".codex", "hooks.json"), event: EVENTS[item.event] };
  return hookEntry(item.event === "after-edit" ? { ...base, matcher: "apply_patch" } : base);
}

export const codexAdapter = makeAdapter({
  agent: "codex",
  inspect: inspectCodex,
  mappers: {
    mcp: forKind("mcp", mcp),
    instructions: forKind("instructions", (i, p) =>
      instructionsEntry(
        i,
        p.global ? join(p.base, ".codex", "AGENTS.md") : join(p.base, "AGENTS.md"),
      ),
    ),
    skill: forKind("skill", (i, p) => skillEntries(i, join(p.base, ".agents", "skills"))),
    hook: forKind("hook", hook),
    command: forKind("command", () =>
      unsupported(
        "Codex 0.171 does not load custom prompt files; a command can be written as a skill instead",
      ),
    ),
    permission: forKind("permission", permission),
    env: forKind("env", env),
  },
});
