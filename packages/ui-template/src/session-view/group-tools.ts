import type { ItemOf, ViewItem } from "./view-items.ts";

type ToolItem = ItemOf<"tool">;

/** Tool kinds that are drawn as a group, alone or in a row; edits, commands and questions never are. */
const quietKinds = new Set(["read", "search"]);

function isQuiet(item: ViewItem): item is ToolItem {
  return item.type === "tool" && quietKinds.has(item.kind);
}

function append(out: ViewItem[], item: ViewItem): void {
  const last = out.at(-1);
  if (!isQuiet(item)) {
    out.push(item);
    return;
  }
  if (last?.type === "tool-group") {
    last.tools.push(item);
    return;
  }
  // Even a lone lookup is drawn as a group, so it keeps its place and element when a second comes.
  out.push({ type: "tool-group", key: `group-${item.key}`, tools: [item] });
}

/** Collapses runs of consecutive read/search tool calls (one or more) into one "tool-group" item. */
export function groupTools(items: readonly ViewItem[]): ViewItem[] {
  const out: ViewItem[] = [];
  for (const item of items) append(out, item);
  return out;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** "Read 6 files", "Searched 2 times" or both, for a group of tool calls. */
export function groupLabel(tools: readonly ToolItem[]): string {
  const reads = tools.filter((tool) => tool.kind === "read").length;
  const searches = tools.length - reads;
  const parts = [];
  if (reads > 0) parts.push(`Read ${plural(reads, "file", "files")}`);
  if (searches > 0)
    parts.push(`${reads > 0 ? "searched" : "Searched"} ${plural(searches, "time", "times")}`);
  return parts.join(", ");
}
