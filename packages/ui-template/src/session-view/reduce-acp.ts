import { diffsIn, diffStatOf } from "./diff-stats.ts";
import type { AcpUpdate } from "./acp-updates.ts";
import { reduceAgentNotice, reduceCompaction, reduceMode } from "./reduce-notices.ts";
import type { ItemOf } from "./view-items.ts";
import { addChunk, findTool, itemKey, pick, type ViewState } from "./view-state.ts";

type AcpMap = { [U in AcpUpdate as U["sessionUpdate"]]: U };
type ToolUpdate = AcpMap["tool_call"] | AcpMap["tool_call_update"];
type Handlers = {
  [K in keyof AcpMap]: (state: ViewState, update: AcpMap[K], seq: number) => void;
};

function pathOf(update: ToolUpdate): string | undefined {
  return update.locations?.[0]?.path ?? diffsIn(update.content)[0]?.path;
}

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
  return tool;
}

function upsertTool(state: ViewState, update: ToolUpdate): void {
  const tool = findTool(state, update.toolCallId) ?? newTool(state, update.toolCallId);
  tool.title = pick(update.title, tool.title);
  tool.kind = pick(update.kind, tool.kind);
  tool.status = pick(update.status, tool.status);
  tool.path = pick(pathOf(update), tool.path);
  tool.stat = pick(diffStatOf(update.content), tool.stat);
}

type ChunkUpdate = AcpMap["user_message_chunk" | "agent_message_chunk" | "agent_thought_chunk"];

function chunkHandler(type: "user" | "message" | "thought") {
  return (state: ViewState, update: ChunkUpdate, seq: number): void => {
    const { text } = update.content;
    addChunk(state, {
      type,
      key: itemKey(type, seq),
      text,
      messageId: update.messageId ?? undefined,
    });
  };
}

/** One small handler per supported ACP session/update kind. */
const acpHandlers: Handlers = {
  user_message_chunk: chunkHandler("user"),
  agent_message_chunk: chunkHandler("message"),
  agent_thought_chunk: chunkHandler("thought"),
  plan: (state, update, seq) => {
    const entries = update.entries.map(({ content, status }) => ({ content, status }));
    const existing = state.items.find((item) => item.type === "plan");
    if (existing) existing.entries = entries;
    else state.items.push({ type: "plan", key: itemKey("plan", seq), entries });
  },
  tool_call: upsertTool,
  tool_call_update: upsertTool,
  current_mode_update: reduceMode,
  notice: reduceAgentNotice,
  compaction_update: reduceCompaction,
};

type Call<K extends keyof AcpMap> = { kind: K; update: AcpMap[K] };

function dispatch<K extends keyof AcpMap>(state: ViewState, call: Call<K>, seq: number): void {
  acpHandlers[call.kind](state, call.update, seq);
}

/** Applies one supported ACP update to the view state. */
export function applyAcpUpdate(state: ViewState, update: AcpUpdate, seq: number): void {
  dispatch(state, { kind: update.sessionUpdate, update }, seq);
}
