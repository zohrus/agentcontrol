/** Tokens of every kind; `total` is input, output and both cache kinds together. */
export type TokenCounts = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
};

/** What a session did, worked out from its saved events. */
export type SessionFacts = {
  /** Prompts the user sent. */
  turns: number;
  /** From the first to the last event. */
  wallMs: number;
  /** Turn time during which the agent was not blocked on a permission request. */
  workingMs: number;
  /** Time permission requests waited for the user's answer. */
  waitingMs: number;
  permissionsRequested: number;
  permissionsAllowed: number;
  permissionsDenied: number;
  /** Tool calls by kind: "read", "edit", "execute", ... Kinds never used are left out. */
  toolCalls: Record<string, number>;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  /** How turns ended: "end_turn", "max_tokens", "cancelled", ... with how many each. */
  stopReasons: Record<string, number>;
};

/** One session as the analytics table shows it. */
export type SessionAnalytics = SessionFacts & {
  sessionId: string;
  workspaceId: string;
  workspace: string;
  title: string;
  agent: string;
  repoPath: string;
  /** The model that used the most tokens; absent when no turn named one. */
  model?: string | undefined;
  tokens: TokenCounts;
  /** Turns that reported tokens. */
  tokenTurns: number;
  /** Cost the agent reported, in US dollars; absent when it reported none. */
  costUsd?: number | undefined;
  /** True when the session used tokens but the agent reported no cost (a subscription login). */
  noCostReported: boolean;
  archived: boolean;
  failed: boolean;
  createdAt: string;
};

/** Tokens and cost of one slice of the data: a day, a model, an agent, a workspace or a repository. */
export type Breakdown = {
  key: string;
  label: string;
  sessions: number;
  /** Turns that reported tokens. */
  turns: number;
  tokens: TokenCounts;
  /** Sum of the costs agents reported; sessions without a reported cost add nothing. */
  costUsd: number;
  /** Sessions here that used tokens and reported no cost, so `costUsd` leaves them out. */
  sessionsWithoutCost: number;
};

export type AnalyticsTotals = {
  sessions: number;
  turns: number;
  tokens: TokenCounts;
  costUsd: number;
  sessionsWithCost: number;
  sessionsWithoutCost: number;
  workingMs: number;
  waitingMs: number;
  permissionsRequested: number;
  permissionsAllowed: number;
  permissionsDenied: number;
  linesAdded: number;
  linesRemoved: number;
};

export type AnalyticsSummary = {
  totals: AnalyticsTotals;
  byDay: Breakdown[];
  byModel: Breakdown[];
  byAgent: Breakdown[];
  byWorkspace: Breakdown[];
  byRepository: Breakdown[];
};

export type AnalyticsSessionSort =
  | "recent"
  | "title"
  | "agent"
  | "model"
  | "workspace"
  | "turns"
  | "tokens"
  | "cost"
  | "working"
  | "waiting"
  | "lines";

/** An observation about the sessions, with the sessions that show it. */
export type Insight = {
  /** The rule that found it, e.g. "long-waits". */
  rule: string;
  /** One plain sentence. */
  text: string;
  /** The sessions behind it, most telling first. */
  sessionIds: string[];
};
