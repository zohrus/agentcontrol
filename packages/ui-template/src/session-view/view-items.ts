import type { FileChange, PermissionOption } from "@agentcontrol/protocol";

export type DiffStat = { additions: number; deletions: number };
type PlanEntryView = { content: string; status: string };

type ToolItem = {
  type: "tool";
  key: string;
  toolCallId: string;
  title: string;
  kind: string;
  status: string;
  path: string | undefined;
  stat: DiffStat | undefined;
};

/** What the stream shows, one shape per kind of item. `key` is stable across updates. */
type ItemMap = {
  user: { type: "user"; key: string; text: string; messageId: string | undefined };
  message: { type: "message"; key: string; text: string; messageId: string | undefined };
  thought: { type: "thought"; key: string; text: string; messageId: string | undefined };
  plan: { type: "plan"; key: string; entries: PlanEntryView[] };
  tool: ToolItem;
  /** A run of consecutive read/search calls, collapsed into one line. */
  "tool-group": { type: "tool-group"; key: string; tools: ToolItem[] };
  mode: { type: "mode"; key: string; modeId: string };
  permission: {
    type: "permission";
    key: string;
    requestId: string;
    title: string;
    options: PermissionOption[];
    answer: string | undefined;
    /** The shell command the agent wants to run, when it is one. */
    command: string | undefined;
    /** The changes the agent wants to make, with their text when the agent sent it. */
    files: FileChange[];
  };
  setup: { type: "setup"; key: string; text: string; exitCode: number | undefined };
  "turn-ended": { type: "turn-ended"; key: string; stopReason: string };
  "agent-exited": {
    type: "agent-exited";
    key: string;
    exitCode: number | null;
    signal: string | undefined;
  };
  notice: { type: "notice"; key: string; text: string };
};

export type ItemType = keyof ItemMap;
export type ViewItem = ItemMap[ItemType];
export type ItemOf<T extends ItemType> = ItemMap[T];
