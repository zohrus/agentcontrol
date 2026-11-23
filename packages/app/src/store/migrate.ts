import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { EMBEDDED_MIGRATIONS } from "./migrations.generated.ts";

const TABLE = "__drizzle_migrations";
const BREAKPOINT = "--> statement-breakpoint";

interface Migration {
  when: number;
  sql: string;
}

function lastApplied(sqlite: Database): number {
  const row = sqlite
    .query(`SELECT created_at FROM ${TABLE} ORDER BY created_at DESC LIMIT 1`)
    .get();
  return row === null ? -1 : Number((row as { created_at: unknown }).created_at);
}

function apply(sqlite: Database, migration: Migration): void {
  for (const statement of migration.sql.split(BREAKPOINT)) sqlite.run(statement);
  const hash = createHash("sha256").update(migration.sql).digest("hex");
  sqlite.run(`INSERT INTO ${TABLE} ("hash", "created_at") VALUES (?, ?)`, [hash, migration.when]);
}

/**
 * Applies the migrations that the database has not seen yet, in one transaction. They are the
 * ones drizzle-kit generated, embedded in the code (see scripts/embed-migrations.ts), and the
 * bookkeeping table is drizzle's own, so a database made from source and one made by a release
 * are the same.
 */
export function migrate(sqlite: Database): void {
  sqlite.run(
    `CREATE TABLE IF NOT EXISTS ${TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );
  const applied = lastApplied(sqlite);
  const pending = EMBEDDED_MIGRATIONS.filter((migration) => migration.when > applied);
  sqlite.transaction(() => {
    for (const migration of pending) apply(sqlite, migration);
  })();
}
