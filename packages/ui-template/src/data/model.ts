import type {
  AgentKind,
  CheckStep,
  DiffResult,
  FsEntry,
  ModifyState,
  RepoWithSetup,
  SessionEvent,
  SessionRow,
  UiVersionEntry,
  UsageRow,
} from "@agentcontrol/sdk";
import type { ConnectionState } from "../status/index.ts";

/** One file as the Changes and Editor tabs show it. */
export type FileVersions = {
  base: string;
  working: string;
  /** Pass this back when saving, so a change made meanwhile is noticed. */
  hash: string;
  /** Something the user should know about this file, e.g. that their save was refused. */
  notice: string | undefined;
};

/** Everything the UI shows that comes from the app. Per-session data is keyed by session id. */
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
  repos: readonly RepoWithSetup[];
  agents: readonly AgentKind[];
  checks: readonly CheckStep[];
  checking: boolean;
  /** Where the Modify agent is; undefined until the app has answered. */
  modify: ModifyState | undefined;
  /** Saved versions of the UI, newest first. */
  versions: readonly UiVersionEntry[];
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
  repos: [],
  agents: [],
  checks: [],
  checking: false,
  modify: undefined,
  versions: [],
};

export const fileKey = (sessionId: string, path: string): string => `${sessionId}\u0000${path}`;
