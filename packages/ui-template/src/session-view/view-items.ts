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

/** One timed step of starting or archiving a session, as the stream shows it. */
export type StepView = {
  id: string;
  label: string;
  state: "running" | "done" | "failed";
  /** When the step began (an ISO time), so a running one can show how long it has been going. */
  startedAt: string;
  /** How long it took; undefined while it runs. */
  durationMs: number | undefined;
};

/** What the stream shows, one shape per kind of item. `key` is stable across updates. */
type ItemMap = {
  user: { type: "user"; key: string; text: string; messageId: string | undefined };
  /** A message the user just sent that the history does not show yet. */
  outgoing: {
    type: "outgoing";
    key: string;
    localId: string;
    text: string;
    state: "sending" | "sent" | "failed";
    error: string | undefined;
  };
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
    /** Set when the relay answered by itself (the Modify agent's permission policy), and why. */
    automatic: { reason: string; refused: boolean } | undefined;
    /** The shell command the agent wants to run, when it is one. */
    command: string | undefined;
    /** The changes the agent wants to make, with their text when the agent sent it. */
    files: FileChange[];
  };
  /** What starting a session (phase "setup") or archiving it (phase "archive") did, step by step. */
  setup: {
    type: "setup";
    key: string;
    phase: "setup" | "archive";
    /** What the setup script printed. */
    text: string;
    exitCode: number | undefined;
    steps: StepView[];
    startedAt: string;
    /** When the setup finished or the session was archived; undefined while it goes on. */
    endedAt: string | undefined;
  };
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
