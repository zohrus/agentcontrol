import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  kind: text("kind", { enum: ["local", "ssh"] }).notNull(),
  sshHost: text("ssh_host"),
  lastSeenAt: text("last_seen_at"),
});

/** Session ids are only unique per relay, so a session is keyed by its workspace and its id. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    agent: text("agent").notNull(),
    status: text("status").notNull(),
    waitingReason: text("waiting_reason"),
    title: text("title").notNull(),
    kind: text("kind", { enum: ["worktree", "directory"] })
      .notNull()
      .default("worktree"),
    repoPath: text("repo_path").notNull(),
    branch: text("branch").notNull(),
    baseBranch: text("base_branch").notNull(),
    lastSeq: integer("last_seq").notNull(),
    createdAt: text("created_at").notNull(),
    archivedAt: text("archived_at"),
    turnRunning: integer("turn_running", { mode: "boolean" }).notNull().default(false),
    pendingPermissionsJson: text("pending_permissions_json").notNull().default("[]"),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.id] })],
);

export const events = sqliteTable(
  "events",
  {
    workspaceId: text("workspace_id").notNull(),
    sessionId: text("session_id").notNull(),
    seq: integer("seq").notNull(),
    ts: text("ts").notNull(),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.sessionId, t.seq] })],
);

/**
 * The version of the relay's event translation that a session's oldest saved events were made
 * with. Newer than this on the relay means the saved `updates` and `tool` are stale.
 */
export const sessionNormalisation = sqliteTable(
  "session_normalisation",
  {
    workspaceId: text("workspace_id").notNull(),
    sessionId: text("session_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.sessionId] })],
);

/** A canonical harness-config item (MCP server, instructions, skill, hook, ...) as JSON. */
export const configItems = sqliteTable("config_items", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  bodyJson: text("body_json").notNull(),
});

/** Where an item applies: one row per scope; repoPath is "" for global and workspace scope. */
export const configScopes = sqliteTable(
  "config_scopes",
  {
    itemId: text("item_id").notNull(),
    scope: text("scope", { enum: ["global", "workspace", "repo"] }).notNull(),
    repoPath: text("repo_path").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.scope, t.repoPath] })],
);
