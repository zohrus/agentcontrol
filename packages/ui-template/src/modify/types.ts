import type { SessionEvent } from "@agentcontrol/protocol";

/** One saved version of the UI, newest first in the history list. */
export type UiVersionEntry = {
  /** Commit id in the hidden UI repository; passed back to `onRestore`. */
  commit: string;
  kind: "template" | "change" | "update" | "undo";
  /** The user's request for a change, or a short description for the other kinds. */
  message: string;
  createdAt: string;
  /** For "template" and "update": the default-UI version, for example "1.2". */
  templateVersion?: string | undefined;
};

/** Where the change being made is, from the user's request to Keep or Undo. */
export type ChangeProgress = {
  status: "idle" | "working" | "checking" | "fixing" | "ready" | "failed";
  /** Files that differ between the new UI and the one running now. */
  changedFiles: readonly string[];
  /** Why the last attempt failed, in plain language. */
  failure?: string | undefined;
  /** The trimmed output of the check that failed last. */
  checkOutput?: string | undefined;
};

/** A default-UI update: first available, then merged and waiting for Keep or Undo. */
export type UiUpdate =
  | { phase: "available"; version: string }
  | { phase: "merged"; version: string; keptAutomatically: number; conflictsResolved: number };

export type ModifyPanelProps = {
  /** The Modify agent's conversation, as relay events. */
  events: readonly SessionEvent[];
  change: ChangeProgress;
  versions: readonly UiVersionEntry[];
  update?: UiUpdate | undefined;
  onSendPrompt: (text: string) => void;
  /** The request just sent, which the app has not taken yet: shown in the chat as being sent. */
  sending?: string | undefined;
  /** The action (keep, undo, discard, restore, update) that was pressed and is not answered yet. */
  pressed?: "keep" | "undo" | "discard" | "restore" | "update" | undefined;
  onKeep: () => void;
  onUndo: () => void;
  /** Throws away a failed or running attempt. */
  onDiscard: () => void;
  onRestore: (commit: string) => void;
  /** The user asked to merge the available default-UI update. */
  onUpdate: () => void;
};
