import { asRecord, asText, type Obj } from "./inspect-shared.ts";
import { HOOK_MARK, jsonEditor, SEP } from "./json-editor.ts";
import type { Entry } from "./types.ts";

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  const sorted = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(sorted.map(([key, inner]) => [key, sortKeys(inner)]));
};

/** JSON text with its keys in a fixed order, so the same data written differently compares equal. */
function canonical(text: string): string {
  return JSON.stringify(sortKeys(JSON.parse(text)));
}

/** The text found in the file is what the entry would write (JSON ignores key order). */
export function sameValue(entry: Entry, found: string | undefined): boolean {
  if (found === undefined) return false;
  return entry.format === "json"
    ? canonical(found) === canonical(entry.value)
    : found === entry.value;
}

const isMarked = (hook: Obj): boolean => (asText(hook.command) ?? "").includes(HOOK_MARK);

/** A hook group in the file with this matcher that runs exactly this command and has no marker. */
function groupRunning(groups: unknown[], want: { matcher: unknown; command: string }): unknown {
  return groups.find((group) => {
    const record = asRecord(group);
    const hooks = Array.isArray(record.hooks) ? (record.hooks as unknown[]).map(asRecord) : [];
    const runs = hooks.some((h) => h.command === want.command && !isMarked(h));
    return record.matcher === want.matcher && runs;
  });
}

const isHookEntry = (entry: Entry): boolean =>
  entry.format === "json" && (entry.key.split(SEP).at(-1) ?? "").startsWith("#");

function groupsAt(current: string | undefined, parent: string[]): unknown[] {
  const groups: unknown = JSON.parse(jsonEditor.get(current ?? "", parent.join(SEP)) ?? "[]");
  return Array.isArray(groups) ? groups : [];
}

/** The matcher and the plain command (no marker) the entry's hook group would run. */
function wantedBy(entry: Entry): { matcher: unknown; command: string } {
  const group = asRecord(JSON.parse(entry.value));
  const hook = asRecord((group.hooks as unknown[])[0]);
  return {
    matcher: group.matcher,
    command: (asText(hook.command) ?? "").split(HOOK_MARK)[0] ?? "",
  };
}

/**
 * A hand-written hook that an import turned into an item is adopted as it is: the entry points at
 * the existing group, so applying writes nothing new and no marker.
 */
export function adoptHandWritten(entry: Entry, current: string | undefined): Entry {
  if (!isHookEntry(entry)) return entry;
  const parent = entry.key.split(SEP).slice(0, -1);
  const found = groupRunning(groupsAt(current, parent), wantedBy(entry));
  if (found === undefined) return entry;
  const text = JSON.stringify(found);
  return { ...entry, key: [...parent, `~${text}`].join(SEP), value: text };
}
