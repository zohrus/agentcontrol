import type { AgentUpdate } from "@agentcontrol/protocol";
import { diffStatOf } from "./diff-stats.ts";
import { reduceMode, reduceNotice } from "./reduce-notices.ts";
import type { ItemOf } from "./view-items.ts";
import { addChunk, findTool, itemKey, pick, relativePath, type ViewState } from "./view-state.ts";

type UpdateMap = { [U in AgentUpdate as U["type"]]: U };
type ToolUpdate = UpdateMap["tool-started" | "tool-updated"];
type TextUpdate = UpdateMap["agent-text" | "agent-thought"];
type Handlers = {
  [K in keyof UpdateMap]: (state: ViewState, update: UpdateMap[K], seq: number) => void;
};

const pathOf = (update: ToolUpdate): string | undefined =>
  update.paths?.[0] ?? update.files?.[0]?.path;

function newTool(state: ViewState, toolCallId: string): ItemOf<"tool"> {
  const tool: ItemOf<"tool"> = {
    type: "tool",
    key: itemKey("tool", toolCallId),
    toolCallId,
    title: "Tool call",
    kind: "other",
    status: "pending",
    path: undefined,
    stat: undefined,
  };
  state.items.push(tool);
  state.tools.set(toolCallId, tool);
  return tool;
}

function upsertTool(state: ViewState, update: ToolUpdate): void {
  const tool = findTool(state, update.toolCallId) ?? newTool(state, update.toolCallId);
  tool.title = pick(update.title, tool.title);
  tool.kind = pick(update.kind, tool.kind);
  tool.status = pick(update.status, tool.status);
  tool.path = pick(relativePath(state, pathOf(update)), tool.path);
  tool.stat = pick(diffStatOf(update.files), tool.stat);
}

function textHandler(type: "message" | "thought") {
  return (state: ViewState, update: TextUpdate, seq: number): void => {
    const { text, messageId } = update;
    addChunk(state, { type, key: itemKey(type, seq), text, messageId });
  };
}

function ignore(): void {}

/**
 * One small handler per normalised update. The user's own message is shown from its
 * `prompt-sent` event, so `user-text` is skipped; usage is shown from the usage rows, and the
 * turn end from its event.
 */
const handlers: Handlers = {
  "user-text": ignore,
  "agent-text": textHandler("message"),
  "agent-thought": textHandler("thought"),
  plan: (state, update, seq) => {
    const entries = update.entries.map(({ content, status }) => ({ content, status }));
    const existing = state.items.find((item) => item.type === "plan");
    if (existing) existing.entries = entries;
    else state.items.push({ type: "plan", key: itemKey("plan", seq), entries });
  },
  "tool-started": upsertTool,
  "tool-updated": upsertTool,
  "mode-changed": reduceMode,
  notice: reduceNotice,
  usage: ignore,
  "turn-usage": ignore,
  "turn-ended": ignore,
  other: ignore,
};

type Call<K extends keyof UpdateMap> = { type: K; update: UpdateMap[K] };

function dispatch<K extends keyof UpdateMap>(state: ViewState, call: Call<K>, seq: number): void {
  handlers[call.type](state, call.update, seq);
}

/** Applies one normalised agent update to the view state. */
export function applyUpdate(state: ViewState, update: AgentUpdate, seq: number): void {
  dispatch(state, { type: update.type, update }, seq);
}
