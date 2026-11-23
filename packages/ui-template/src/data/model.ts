import type {
  AgentKind,
  ApplyResult,
  CheckStep,
  ConfigAgent,
  ConfigPlan,
  DiffResult,
  DriftReport,
  FsEntry,
  ModifyState,
  RepoWithSetup,
  ScopedItem,
  SessionEvent,
  SessionRow,
  UiVersionEntry,
  UsageRow,
  WorkspaceInfo,
} from "@agentcontrol/sdk";
import type { ConnectionState } from "../status/index.ts";
import { keyOf, type SessionRef } from "./session-ref.ts";

/** One file as the Changes and Editor tabs show it. */
export type FileVersions = {
  base: string;
  working: string;
  /** Pass this back when saving, so a change made meanwhile is noticed. */
  hash: string;
  /** Something the user should know about this file, e.g. that their save was refused. */
  notice: string | undefined;
};

/** What a workspace offers a new session: its repositories and the agents it can run. */
export type Choices = {
  repos: readonly RepoWithSetup[];
  agents: readonly AgentKind[];
};

/** The health checklist of one workspace. */
export type WorkspaceCheck = { steps: readonly CheckStep[]; running: boolean };

/** What the agents already have configured, per agent, as found by "Import existing setup". */
export type FoundSetup = { agent: ConfigAgent; items: readonly ScopedItem[] };

/** Harness configuration: the items, the last review, the last apply and what is out of step. */
export type ConfigState = {
  /** False until the items have arrived. */
  loaded: boolean;
  items: readonly ScopedItem[];
  /** The file changes the last "Review changes" showed; nothing is written until it is applied. */
  plan: ConfigPlan | undefined;
  /** What the last apply wrote, so it can be undone. */
  applied: ApplyResult | undefined;
  /** Files that changed after the last apply, found when the user tried to undo it. */
  undoBlockedBy: readonly string[];
  drift: DriftReport | undefined;
  found: readonly FoundSetup[] | undefined;
};

/** Everything the UI shows that comes from the app. Per-session data is keyed by `keyOf(ref)`. */
export type DataState = {
  connection: ConnectionState;
  /** False until the first session list has arrived. */
  loaded: boolean;
  sessions: readonly SessionRow[];
  events: Readonly<Record<string, readonly SessionEvent[]>>;
  usage: Readonly<Record<string, readonly UsageRow[]>>;
  diffs: Readonly<Record<string, DiffResult>>;
  trees: Readonly<Record<string, readonly FsEntry[]>>;
  /** Why a session's changes could not be read. */
  changesErrors: Readonly<Record<string, string>>;
  /** Files by `fileKey`. */
  files: Readonly<Record<string, FileVersions>>;
  /** Every workspace, removed ones included. */
  workspaces: readonly WorkspaceInfo[];
  /** Repositories and agents by workspace id. */
  choices: Readonly<Record<string, Choices>>;
  /** The latest checklist by workspace id. */
  checks: Readonly<Record<string, WorkspaceCheck>>;
  config: ConfigState;
  /** Where the Modify agent is; undefined until the app has answered. */
  modify: ModifyState | undefined;
  /** Saved versions of the UI, newest first. */
  versions: readonly UiVersionEntry[];
};

export const initialConfig: ConfigState = {
  loaded: false,
  items: [],
  plan: undefined,
  applied: undefined,
  undoBlockedBy: [],
  drift: undefined,
  found: undefined,
};

export const initialState: DataState = {
  connection: "reconnecting",
  loaded: false,
  sessions: [],
  events: {},
  usage: {},
  diffs: {},
  trees: {},
  changesErrors: {},
  files: {},
  workspaces: [],
  choices: {},
  checks: {},
  config: initialConfig,
  modify: undefined,
  versions: [],
};

export const fileKey = (ref: SessionRef, path: string): string => `${keyOf(ref)}\u0001${path}`;
