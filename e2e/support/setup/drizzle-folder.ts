import { readFile } from "node:fs/promises";
import { join } from "node:path";

const journalPath = join(import.meta.dir, "../../../packages/app/drizzle/meta/_journal.json");

/** What the repository's drizzle folder holds: how many migrations a new database must get. */
export async function theMigrationsOfTheRepository(): Promise<{ migrations: number }> {
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as { entries: unknown[] };
  return { migrations: journal.entries.length };
}
