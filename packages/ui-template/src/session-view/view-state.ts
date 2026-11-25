import type { ItemOf, ViewItem } from "./view-items.ts";

/** The items built so far; reducers add to it or update items in place. */
export type ViewState = {
  items: ViewItem[];
  /** The tool items by tool call id, so an update finds its tool without a scan. */
  tools: Map<string, ItemOf<"tool">>;
  /** True while events that arrive live are folded in (not a history loaded at once). */
  live: boolean;
  /** The session's worktree folder: paths below it are shown relative to it. */
  root?: string;
};

export const createViewState = (): ViewState => ({ items: [], tools: new Map(), live: false });

/** A path shown relative to the session's folder, as the agent sees its project. */
export function relativePath(state: ViewState, path: string): string;
export function relativePath(state: ViewState, path: string | undefined): string | undefined;
export function relativePath(state: ViewState, path: string | undefined): string | undefined {
  if (state.root === undefined || path === undefined) return path;
  const prefix = `${withoutPrivate(state.root).replace(/\/+$/, "")}/`;
  const plain = withoutPrivate(path);
  return plain.startsWith(prefix) ? plain.slice(prefix.length) : path;
}

/** On a Mac the same folder is `/var/x` and `/private/var/x`; agents may report either. */
function withoutPrivate(path: string): string {
  return path.replace(/^\/private(?=\/(?:var|tmp|etc)\/)/, "");
}

type ChunkItem = ItemOf<"user" | "message" | "thought">;
type Chunk = { type: ChunkItem["type"]; key: string; text: string; messageId: string | undefined };

/** Appends a text chunk to the previous item when it is the same kind and message. */
export function addChunk(state: ViewState, chunk: Chunk): void {
  const last = state.items.at(-1);
  if (last?.type === chunk.type && last.messageId === chunk.messageId) {
    last.text += chunk.text;
    return;
  }
  state.items.push(beginning(state, chunk));
}

/** A text that begins while the page watches is marked, so that its first words are revealed too. */
const beginning = (state: ViewState, chunk: Chunk): Chunk & { fresh?: boolean } =>
  state.live && chunk.type !== "user" ? { ...chunk, fresh: true } : chunk;

export function findTool(state: ViewState, toolCallId: string): ItemOf<"tool"> | undefined {
  return state.tools.get(toolCallId);
}

export function findPermission(
  state: ViewState,
  requestId: string,
): ItemOf<"permission"> | undefined {
  return state.items.find(
    (item): item is ItemOf<"permission"> =>
      item.type === "permission" && item.requestId === requestId,
  );
}

/** A stable item key such as "tool-3". */
export function itemKey(prefix: string, id: number | string): string {
  return `${prefix}-${String(id)}`;
}

/** The value to keep: the update's when it carries one, else the current. */
export function pick<T>(next: T | null | undefined, current: T): T {
  return next ?? current;
}
