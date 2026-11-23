import { Database } from "bun:sqlite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const appDir = join(import.meta.dir, "../../../packages/app");
const BREAKPOINT = "--> statement-breakpoint";

interface JournalEntry {
  when: number;
  tag: string;
}

/** The migrations the repository has, as the release before the usage table had them applied. */
async function migrationsBeforeUsage(): Promise<Array<{ when: number; sql: string }>> {
  const text = await readFile(join(appDir, "drizzle/meta/_journal.json"), "utf8");
  const { entries } = JSON.parse(text) as { entries: JournalEntry[] };
  const older = entries.filter((entry) => !entry.tag.includes("woozy_union_jack"));
  return Promise.all(
    older.map(async ({ when, tag }) => ({
      when,
      sql: await readFile(join(appDir, "drizzle", `${tag}.sql`), "utf8"),
    })),
  );
}

function applyEarlyMigrations(sqlite: Database, migrations: Array<{ when: number; sql: string }>) {
  sqlite.run(
    "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
  );
  for (const { when, sql } of migrations) {
    for (const statement of sql.split(BREAKPOINT)) sqlite.run(statement);
    sqlite.run("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", ["old", when]);
  }
}

const EVENTS = [
  [
    "session-created",
    {
      agent: "mock",
      repoPath: "/repo",
      baseBranch: "main",
      branch: "b",
      worktreePath: "/w",
      title: "Written last month",
    },
  ],
  ["prompt-sent", { text: "Prompt 1" }],
  ["turn-ended", { stopReason: "end_turn" }],
] as const;

function saveOneFinishedSession(sqlite: Database): void {
  sqlite.run(
    `INSERT INTO sessions (id, workspace_id, agent, status, title, kind, repo_path, branch, base_branch, last_seq, created_at)
     VALUES ('old-session', 'local', 'mock', 'idle', 'Written last month', 'worktree', '/repo', 'b', 'main', 3, '2026-01-05T10:00:00.000Z')`,
  );
  EVENTS.forEach(([kind, payload], index) => {
    const ts = new Date(Date.parse("2026-01-05T10:00:00Z") + index * 60_000).toISOString();
    sqlite.run(
      "INSERT INTO events (workspace_id, session_id, seq, ts, kind, payload_json) VALUES ('local', 'old-session', ?, ?, ?, ?)",
      [index + 1, ts, kind, JSON.stringify(payload)],
    );
  });
}

/**
 * Leaves the app's database as the release before the usage table made it: every migration but the
 * usage one applied, and one finished session with three events in it.
 */
export async function anAppDatabaseFromBeforeTheUsageTable(dataDir: string): Promise<void> {
  const migrations = await migrationsBeforeUsage();
  const sqlite = new Database(join(dataDir, "state.db"), { create: true });
  applyEarlyMigrations(sqlite, migrations);
  saveOneFinishedSession(sqlite);
  sqlite.close();
}
