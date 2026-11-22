import { join } from "node:path";
import type { EnvItem, HookItem, McpItem, PermissionItem } from "@agentcontrol/protocol";
import { makeAdapter } from "./adapter.ts";
import { inspectClaude } from "./claude-inspect.ts";
import {
  commandEntry,
  compact,
  forKind,
  hookEntry,
  instructionsEntry,
  isSafeName,
  isSafeVar,
  skillEntries,
  unsupported,
} from "./entries.ts";
import { keyOf } from "./json-editor.ts";
import type { Entry, Mapped, Place } from "./types.ts";

const EVENTS = {
  "before-tool": "PreToolUse",
  "after-edit": "PostToolUse",
  "session-start": "SessionStart",
  "session-stop": "Stop",
} as const;
const MODES = {
  ask: "default",
  "auto-edit": "acceptEdits",
  "full-auto": "bypassPermissions",
} as const;

const dir = (place: Place): string => join(place.base, ".claude");
const settings = (place: Place): string => join(dir(place), "settings.json");

function json(input: { file: string; itemId: string; key: string; value: unknown }): Entry {
  const { value, ...rest } = input;
  return { ...rest, format: "json", value: JSON.stringify(value) };
}

function server(item: McpItem): Record<string, unknown> | undefined {
  if (item.url) return compact({ type: "http", url: item.url, headers: item.headers });
  if (!item.command) return undefined;
  return compact({ type: "stdio", command: item.command, args: item.args, env: item.env });
}

function mcp(item: McpItem, place: Place): Mapped {
  if (!isSafeName(item.name)) return unsupported(`"${item.name}" is not a valid MCP server name`);
  const value = server(item);
  if (!value) return unsupported("an MCP server needs a command or a url");
  const file = place.global ? join(place.base, ".claude.json") : join(place.base, ".mcp.json");
  return {
    entries: [json({ file, itemId: item.id, key: keyOf("mcpServers", item.name), value })],
    unsupported: [],
  };
}

function permission(item: PermissionItem, place: Place): Mapped {
  const file = settings(place);
  const rule = (list: "allow" | "deny", text: string): Entry =>
    json({ file, itemId: item.id, key: keyOf("permissions", list, `=${text}`), value: text });
  const entries = [
    ...item.allow.map((r) => rule("allow", r)),
    ...item.deny.map((r) => rule("deny", r)),
  ];
  if (item.mode) {
    const key = keyOf("permissions", "defaultMode");
    entries.push(json({ file, itemId: item.id, key, value: MODES[item.mode] }));
  }
  return { entries, unsupported: [] };
}

function env(item: EnvItem, place: Place): Mapped {
  const names = Object.keys(item.vars);
  const entries = names
    .filter(isSafeVar)
    .map((n) =>
      json({ file: settings(place), itemId: item.id, key: keyOf("env", n), value: item.vars[n] }),
    );
  const bad = names.filter((n) => !isSafeVar(n)).map((n) => `"${n}" is not a valid variable name`);
  return { entries, unsupported: bad };
}

function hook(item: HookItem, place: Place): Mapped {
  const matcher = item.event === "after-edit" ? "Edit|Write|MultiEdit" : undefined;
  const base = { item, file: settings(place), event: EVENTS[item.event] };
  return hookEntry(matcher === undefined ? base : { ...base, matcher });
}

export const claudeAdapter = makeAdapter({
  agent: "claude-code",
  inspect: inspectClaude,
  mappers: {
    mcp: forKind("mcp", mcp),
    instructions: forKind("instructions", (i, p) =>
      instructionsEntry(i, p.global ? join(dir(p), "CLAUDE.md") : join(p.base, "CLAUDE.md")),
    ),
    skill: forKind("skill", (i, p) => skillEntries(i, join(dir(p), "skills"))),
    hook: forKind("hook", hook),
    command: forKind("command", (i, p) =>
      commandEntry(i, join(dir(p), "commands", `${i.name}.md`)),
    ),
    permission: forKind("permission", permission),
    env: forKind("env", env),
  },
});
