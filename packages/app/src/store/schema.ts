import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  kind: text("kind", { enum: ["local", "ssh"] }).notNull(),
  sshHost: text("ssh_host"),
  lastSeenAt: text("last_seen_at"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  agent: text("agent").notNull(),
  status: text("status").notNull(),
  waitingReason: text("waiting_reason"),
  title: text("title").notNull(),
  repoPath: text("repo_path").notNull(),
  branch: text("branch").notNull(),
  baseBranch: text("base_branch").notNull(),
  lastSeq: integer("last_seq").notNull(),
  createdAt: text("created_at").notNull(),
  archivedAt: text("archived_at"),
});

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
