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
  templateVersion?: string;
};

/** Where the check gate is for the change being made. */
export type CheckGate = "idle" | "checking" | "failed" | "ready";

/** A default-UI update: first available, then merged and waiting for Keep or Undo. */
export type UiUpdate =
  | { phase: "available"; version: string }
  | { phase: "merged"; version: string; keptAutomatically: number; conflictsResolved: number };

export type ModifyPanelProps = {
  /** The Modify agent's conversation, as relay events. */
  events: readonly SessionEvent[];
  gate: CheckGate;
  versions: readonly UiVersionEntry[];
  update?: UiUpdate | undefined;
  onSendPrompt: (text: string) => void;
  onKeep: () => void;
  onUndo: () => void;
  onRestore: (commit: string) => void;
  /** The user asked to merge the available default-UI update. */
  onUpdate: () => void;
};
