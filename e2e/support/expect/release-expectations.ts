import { Database } from "bun:sqlite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppAccess } from "../setup/app.ts";
import type { ReleaseApp } from "../setup/release-app.ts";
import type { ResourcesFolder } from "../setup/release-folder.ts";

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
export function expectEveryMigrationToBeApplied(
  app: AppAccess,
  repository: { migrations: number },
): void {
  const database = new Database(join(app.dataDir, "state.db"), { readonly: true });
  const row = database.query("SELECT count(*) AS applied FROM __drizzle_migrations").get() as {
    applied: number;
  };
  database.close();
  if (row.applied !== repository.migrations) {
    throw new Error(
      `expected all ${String(repository.migrations)} migrations in packages/app/drizzle to be applied, but ${String(row.applied)} were (run bun scripts/embed-migrations.ts)`,
    );
  }
}

/** Reading where the app's default UI is fails, and the message names the place it looked. */
export function expectReadingTheDefaultUiToFailSaying(read: () => unknown, text: string): void {
  try {
    read();
  } catch (error) {
    if (String(error).includes(text)) return;
    throw new Error(`expected the failure to mention "${text}", but it said: ${String(error)}`);
  }
  throw new Error(`expected the app to fail mentioning "${text}", but it did not fail`);
}
