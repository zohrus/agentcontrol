import { join } from "node:path";
import type {
  CommandItem,
  ConfigItem,
  HookItem,
  InstructionsItem,
  SkillItem,
} from "@agentcontrol/protocol";
import { HOOK_MARK, keyOf } from "./json-editor.ts";
import { REST_KEY } from "./markdown-editor.ts";
import type { Entry, Mapped, Place } from "./types.ts";

const NONE: Mapped = { entries: [], unsupported: [] };
export const unsupported = (reason: string): Mapped => ({ entries: [], unsupported: [reason] });

export type Mapper = (item: ConfigItem, place: Place) => Mapped;
export type Kind = ConfigItem["kind"];

/** Narrow a mapper to one item kind so every adapter table entry is fully typed. */
export function forKind<K extends Kind>(
  kind: K,
  fn: (item: Extract<ConfigItem, { kind: K }>, place: Place) => Mapped,
): Mapper {
  const is = (item: ConfigItem): item is Extract<ConfigItem, { kind: K }> => item.kind === kind;
  return (item, place) => (is(item) ? fn(item, place) : NONE);
}

export const isSafeName = (name: string): boolean => /^[A-Za-z0-9_-]+$/.test(name);
export const isSafeId = (id: string): boolean => /^[\w:.-]+$/.test(id);
export const isSafeVar = (name: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

const one = (entry: Entry): Mapped => ({ entries: [entry], unsupported: [] });

export const compact = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export function instructionsEntry(item: InstructionsItem, file: string): Mapped {
  const key = item.handWritten === true ? REST_KEY : item.id;
  return one({ file, format: "md", key, itemId: item.id, value: item.text });
}

const safeRelative = (path: string): boolean =>
  !path.startsWith("/") && !path.split("/").includes("..");

export function skillEntries(item: SkillItem, dir: string): Mapped {
  if (!isSafeName(item.name)) return unsupported(`"${item.name}" is not a valid skill folder name`);
  if (!item.files.every((f) => safeRelative(f.path)))
    return unsupported("a skill file path leaves the skill folder");
  const entries = item.files.map((f) => ({
    file: join(dir, item.name, f.path),
    format: "file" as const,
    key: "",
    itemId: item.id,
    value: f.content,
  }));
  return { entries, unsupported: [] };
}

export function commandEntry(item: CommandItem, file: string): Mapped {
  if (!isSafeName(item.name)) return unsupported(`"${item.name}" is not a valid command name`);
  const head =
    item.description === undefined
      ? ""
      : `---\ndescription: ${JSON.stringify(item.description)}\n---\n\n`;
  return one({ file, format: "file", key: "", itemId: item.id, value: `${head}${item.prompt}\n` });
}

/** Hooks share the Claude Code JSON shape: event -> groups of {matcher, hooks:[{type, command}]}. */
export function hookEntry(input: {
  item: HookItem;
  file: string;
  event: string;
  matcher?: string;
}): Mapped {
  const { item, file, event } = input;
  const matcher = item.matcher ?? input.matcher;
  const group = compact({
    matcher: matcher === "" ? undefined : matcher,
    hooks: [{ type: "command", command: `${item.command}${HOOK_MARK}${item.id}` }],
  });
  const key = keyOf("hooks", event, `#${item.id}`);
  return one({ file, format: "json", key, itemId: item.id, value: JSON.stringify(group) });
}
