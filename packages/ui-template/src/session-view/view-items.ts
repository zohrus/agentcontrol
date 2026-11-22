import type { PermissionOption } from "@agentcontrol/protocol";

export type DiffStat = { additions: number; deletions: number };
type PlanEntryView = { content: string; status: string };

/** What the stream shows, one shape per kind of item. `key` is stable across updates. */
type ItemMap = {
  user: { type: "user"; key: string; text: string; messageId: string | undefined };
  message: { type: "message"; key: string; text: string; messageId: string | undefined };
  thought: { type: "thought"; key: string; text: string; messageId: string | undefined };
  plan: { type: "plan"; key: string; entries: PlanEntryView[] };
  tool: {
    type: "tool";
    key: string;
    toolCallId: string;
    title: string;
    kind: string;
    status: string;
    path: string | undefined;
    stat: DiffStat | undefined;
  };
  permission: {
    type: "permission";
    key: string;
    requestId: string;
    title: string;
    options: PermissionOption[];
    answer: string | undefined;
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
