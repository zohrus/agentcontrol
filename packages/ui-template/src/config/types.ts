import type { ConfigAgent, ScopedItem } from "@agentcontrol/protocol";
import type { ConfigTarget } from "@agentcontrol/sdk";

/** What the Config screen can ask for; each says whether it worked (a failure is reported already). */
export type ConfigActions = {
  load: () => Promise<boolean>;
  /** Changes the stored items; `change` gets them as they are when its turn comes. */
  change: (change: (items: readonly ScopedItem[]) => readonly ScopedItem[]) => Promise<boolean>;
  review: (target: ConfigTarget) => Promise<boolean>;
  apply: () => Promise<boolean>;
  /** Says whether files were put back; false also when they changed since and need a confirmation. */
  undo: (force: boolean) => Promise<boolean>;
  findExisting: (agents: readonly ConfigAgent[]) => Promise<boolean>;
  keepManualEdit: (call: { agent: ConfigAgent; itemIds: readonly string[] }) => Promise<boolean>;
  /** Declines an undo that was held back by files changed since: the apply stays undoable. */
  keepApply: () => void;
  forgetFound: () => void;
  forgetReview: () => void;
};
