import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export type Db = ReturnType<typeof drizzle>;

const MIGRATIONS = join(import.meta.dir, "../../drizzle");
const CHUNK = 500;

/** Split rows into batches that stay below SQLite's bound-variable limit. */
export function* chunks<T>(items: T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += CHUNK) yield items.slice(i, i + CHUNK);
}

/** Open the SQLite file in WAL mode and apply pending migrations. */
export function openDatabase(path: string): { sqlite: Database; db: Db } {
  const sqlite = new Database(path, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS });
  return { sqlite, db };
}
