import { Database } from "bun:sqlite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppAccess } from "../setup/app.ts";
import type { ReleaseApp } from "../setup/release-app.ts";
import type { ResourcesFolder } from "../setup/release-folder.ts";

const journalPath = join(import.meta.dir, "../../../packages/app/drizzle/meta/_journal.json");

async function markerSeenFrom(app: AppAccess, folder: "ui" | "ui-staging"): Promise<string> {
  const marker = join(app.dataDir, folder, "node_modules", "marker.txt");
  return readFile(marker, "utf8").catch(() => "(no dependencies found)");
}

/** The live and the staging UI both use the dependencies of this resources folder. */
export async function expectUiDependenciesToComeFrom(
  app: AppAccess,
  resources: ResourcesFolder,
): Promise<void> {
  for (const folder of ["ui", "ui-staging"] as const) {
    const seen = await markerSeenFrom(app, folder);
    if (seen !== resources.modulesMarker) {
      throw new Error(
        `expected the dependencies of the ${folder} folder to come from "${resources.modulesMarker}", but they come from "${seen}"`,
      );
    }
  }
}

/** The app answers its root address with the UI that is in its data folder, served by Vite. */
export async function expectUiServedFromTheDataFolder(app: ReleaseApp): Promise<void> {
  const answer = await fetch(`${app.baseUrl}/`);
  const page = await answer.text();
  const copy = await readFile(join(app.dataDir, "ui", "index.html"), "utf8");
  if (answer.status !== 200 || !page.includes("Fixture UI") || !copy.includes("Fixture UI")) {
    throw new Error(
      `expected the app to serve the fixture UI from ${app.dataDir}/ui, but / answered ${String(answer.status)}: ${page}`,
    );
  }
}

/** The app's database has every migration of the drizzle folder, not only the ones it was built with. */
export async function expectEveryMigrationToBeApplied(app: AppAccess): Promise<void> {
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as { entries: unknown[] };
  const database = new Database(join(app.dataDir, "state.db"), { readonly: true });
  const row = database.query("SELECT count(*) AS applied FROM __drizzle_migrations").get() as {
    applied: number;
  };
  database.close();
  if (row.applied !== journal.entries.length) {
    throw new Error(
      `expected all ${String(journal.entries.length)} migrations in packages/app/drizzle to be applied, but ${String(row.applied)} were (run \`bun run db:generate\`'s embed step: bun scripts/embed-migrations.ts)`,
    );
  }
}
