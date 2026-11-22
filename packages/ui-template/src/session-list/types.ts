import type { SessionSummary } from "@agentcontrol/protocol";

/** One session in the list, with the workspace it runs on and an optional second line. */
export type SessionListEntry = {
  summary: SessionSummary;
  /** Display name of the workspace (machine) the session runs on. */
  workspace: string;
  /** Second line of the row; defaults to the agent and status. */
  detail?: string;
};

/** What a custom session row receives from the list. */
export type SessionRowProps = {
  entry: SessionListEntry;
  selected: boolean;
  onSelect: () => void;
};
