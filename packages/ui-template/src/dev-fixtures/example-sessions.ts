import { SessionSummary } from "@agentcontrol/protocol";
import type { StatusStats } from "../layout/index.ts";
import type { PendingPermission, SessionListEntry } from "../session-list/index.ts";
import type { SessionUsage } from "../status/index.ts";

/** EXAMPLE DATA: sessions across three workspaces, as the session list shows them. */
type Row = {
  id: string;
  workspace: string;
  title: string;
  agent: "claude-code" | "codex" | "mock";
  status: SessionSummary["status"];
  waitingReason?: SessionSummary["waitingReason"];
  detail: string;
};

const rows: Row[] = [
  {
    id: "example-rate-limit",
    workspace: "dev-box",
    title: "Rate limit API",
    agent: "claude-code",
    status: "waiting",
    waitingReason: "permission",
    detail: "Claude Code · wants to run npm test",
  },
  {
    id: "example-flaky",
    workspace: "dev-box",
    title: "Fix flaky e2e tests",
    agent: "codex",
    status: "running",
    detail: "Codex · running 6m · 2 files",
  },
  {
    id: "example-react",
    workspace: "dev-box",
    title: "Upgrade to React 19",
    agent: "claude-code",
    status: "done",
    detail: "Claude Code · done · +412 −98",
  },
  {
    id: "example-eval",
    workspace: "gpu-01",
    title: "Eval harness refactor",
    agent: "codex",
    status: "waiting",
    waitingReason: "reply",
    detail: "Codex · asked which metric to keep",
  },
  {
    id: "example-profile",
    workspace: "gpu-01",
    title: "Profile data loader",
    agent: "claude-code",
    status: "running",
    detail: "Claude Code · running 21m",
  },
  {
    id: "example-setup",
    workspace: "gpu-01",
    title: "Migrate CI cache",
    agent: "claude-code",
    status: "waiting",
    waitingReason: "setup-failed",
    detail: "Claude Code · npm install exited 1",
  },
  {
    id: "example-cost",
    workspace: "local",
    title: "UI: add cost column",
    agent: "claude-code",
    status: "done",
    detail: "Modify agent · kept",
  },
  {
    id: "example-old",
    workspace: "local",
    title: "Old spike",
    agent: "mock",
    status: "archived",
    detail: "Archived",
  },
];

const pendingPermission: PendingPermission = {
  requestId: "req-1",
  title: "Run npm test -- rateLimit",
  options: [
    { optionId: "allow", name: "Allow once", kind: "allow_once" },
    { optionId: "reject", name: "Deny", kind: "reject_once" },
  ],
};

function toEntry(row: Row, index: number): SessionListEntry {
  const summary = SessionSummary.parse({
    id: row.id,
    agent: row.agent,
    status: row.status,
    waitingReason: row.waitingReason,
    title: row.title,
    repoPath: "~/api",
    branch: "agent/" + row.id.replace("example-", ""),
    baseBranch: "main",
    lastSeq: 20 + index,
    createdAt: new Date(Date.now() - (25 + index * 9) * 60_000).toISOString(),
    archivedAt: row.status === "archived" ? new Date().toISOString() : undefined,
  });
  const pending = row.id === "example-rate-limit" ? { pendingPermission } : {};
  return { summary, workspace: row.workspace, detail: row.detail, ...pending };
}

export const exampleSessions: SessionListEntry[] = rows.map(toEntry);

function count(status: SessionSummary["status"]): number {
  return exampleSessions.filter((entry) => entry.summary.status === status).length;
}

export const exampleStats: StatusStats = {
  waiting: count("waiting"),
  running: count("running"),
  today: "$14.20",
  connected: ["dev-box", "gpu-01"],
};

export const exampleWorktreePath = "/Users/dev/.agentcontrol/worktrees/rate-limit";

/** EXAMPLE DATA: tokens and cost of the open session. */
export const exampleUsage: SessionUsage = {
  inputTokens: 48_200,
  outputTokens: 6_900,
  cacheReadTokens: 210_000,
  cacheWriteTokens: 31_000,
  costUsd: 0.62,
};
