import type { ItemOf, ViewItem } from "./view-items.ts";

/** The items built so far; reducers add to it or update items in place. */
export type ViewState = {
  items: ViewItem[];
  /** The session's worktree folder: paths below it are shown relative to it. */
  root?: string;
};

/** A path shown relative to the session's folder, as the agent sees its project. */
export function relativePath(state: ViewState, path: string): string;
export function relativePath(state: ViewState, path: string | undefined): string | undefined;
export function relativePath(state: ViewState, path: string | undefined): string | undefined {
  const prefix = state.root === undefined ? undefined : `${state.root.replace(/\/+$/, "")}/`;
  return prefix !== undefined && path?.startsWith(prefix) ? path.slice(prefix.length) : path;
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
  state.items.push(chunk);
}

export function findTool(state: ViewState, toolCallId: string): ItemOf<"tool"> | undefined {
  return state.items.find(
    (item): item is ItemOf<"tool"> => item.type === "tool" && item.toolCallId === toolCallId,
  );
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
