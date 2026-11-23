import type { AgentKind, SessionId } from "@agentcontrol/protocol";
import type { RelayCalls, SessionEvents } from "./agent-turns.ts";

/** Where one Modify request is: asked, checked, waiting for Keep or Undo, or given up. */
export type ModifyStatus = "idle" | "working" | "checking" | "fixing" | "ready" | "failed";

/** The check gate as the UI's Modify panel shows it. */
export type ModifyGate = "idle" | "checking" | "failed" | "ready";

/** A default-UI update: available, or merged and waiting for Keep or Undo. */
export type ModifyUpdate =
  | { phase: "available"; version: string }
  | { phase: "merged"; version: string; keptAutomatically: number; conflictsResolved: number };

/** Everything the UI (and /_safe) shows about the Modify agent. */
export interface ModifyState {
  status: ModifyStatus;
  /** What the review bar shows: mapped from `status` so the panel needs no logic. */
  gate: ModifyGate;
  /** What the user asked for; the message of the version Keep records. */
  request?: string;
  /** The Modify agent's session; its events are the chat. */
  sessionId?: SessionId;
  /** Files that differ between the new UI and the one running now. */
  changedFiles: string[];
  /** Why the last attempt failed, in plain language. */
  failure?: string;
  /** The trimmed output of the check that failed last. */
  checkOutput?: string;
  /** A short summary of the change waiting for Keep or Undo, for example an update's. */
  summary?: string;
  /** The default-UI update, when one is available or merged. */
  update?: ModifyUpdate;
}

/** A request the Modify agent cannot take now; the message says why in plain words. */
export class ModifyRefusal extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ModifyOptions {
  dataDir: string;
  /** The default UI of this app release (the template package). */
  templateDir: string;
  templateVersion: string;
  /** Which agent makes the changes. */
  agent: AgentKind;
  relay: RelayCalls;
  events: SessionEvents;
  /** Shows a new state to listeners (the SSE stream). */
  publish: (state: ModifyState) => void;
}

/** The change being made right now, from the user's request to Keep or Undo. */
export interface Change {
  kind: "change" | "update";
  /** What the user asked for, newest last; Keep records them as the version's message. */
  requests: string[];
  /** The session's first message when it has to start fresh: the rules and what is asked. */
  preface: string;
  title: string;
  /** Bumped when the change is discarded, so a turn or check still running knows to stop. */
  generation: number;
  /** The newest saved version when the change began to wait for Keep or Undo; Keep adds a newer one. */
  baseCommit?: string;
  /** For an update: the default-UI version being merged and what the merge did. */
  merge?: { version: string; keptAutomatically: number; conflictsResolved: number };
}
