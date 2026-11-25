import { Database } from "bun:sqlite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppAccess } from "../setup/app.ts";
import type { ReleaseApp } from "../setup/release-app.ts";
import { eventually } from "../setup/eventually.ts";
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

/** A first build takes a few seconds, with Vite starting up on a loaded machine. */
const BUILD_WAIT_MS = 30_000;

/** The app answers its root address with the built UI that was made from the data folder's UI. */
export async function expectUiServedFromTheDataFolder(app: ReleaseApp): Promise<void> {
  const copy = await readFile(join(app.dataDir, "ui", "index.html"), "utf8");
  await eventually(
    `expected the app to serve the fixture UI built from ${app.dataDir}/ui`,
    async () => {
      const answer = await fetch(`${app.baseUrl}/`);
      const page = await answer.text();
      const built =
        answer.status === 200 && page.includes("Fixture UI") && copy.includes("Fixture UI");
      return built ? undefined : `/ answered ${String(answer.status)}: ${page}`;
    },
    BUILD_WAIT_MS,
  );
}

/** The built UI's script is handed out, not refused. */
export async function expectUiScriptToBeServed(app: ReleaseApp): Promise<void> {
  await eventually(
    "expected the app to serve the script of the built UI",
    async () => {
      const page = await (await fetch(`${app.baseUrl}/`)).text();
      const source = /<script[^>]* src="([^"]+)"/.exec(page)?.[1];
      if (source === undefined) return `the page names no script: ${page}`;
      const answer = await fetch(`${app.baseUrl}${source}`);
      return answer.status === 200 ? undefined : `${source} answered ${String(answer.status)}`;
    },
    BUILD_WAIT_MS,
  );
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
