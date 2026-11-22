export interface UiVersion {
  commit: string;
  kind: "template" | "change" | "update" | "undo";
  message: string;
  createdAt: string;
  templateVersion?: string;
}
export interface MergeOutcome {
  status: "clean" | "conflicts" | "up-to-date";
  conflictedFiles: string[];
  /** Messages of the user's change commits since the last template or update commit. */
  keptRequests: string[];
}
