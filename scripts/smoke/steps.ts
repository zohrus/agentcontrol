// The steps of the compiled-app smoke test, in order. Each throws a plain sentence when it fails.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adapterRunsWithACleanEnvironment } from "./adapter-step.ts";
import { callApi, waitUntil } from "./api.ts";
import type { SmokeApp } from "./app-process.ts";
import { expect, type Step, pageAt } from "./check.ts";
import { builtUiServesChange, leavesResourcesAlone, modifyPromotes } from "./modify-steps.ts";
import { sessionRuns } from "./session-steps.ts";
import { terminalRuns } from "./terminal-step.ts";

const migrationsJournal = join(import.meta.dir, "../../packages/app/drizzle/meta/_journal.json");

async function health(app: SmokeApp): Promise<void> {
  // The app is healthy only with its relay connected: a compiled app that cannot start its relay
  // fails here. The app listens before that (it used to wait for Vite, which hid the delay).
  let last = "nothing yet";
  await waitUntil({
    what: "/api/health to report the relay connected",
    seconds: 30,
    read: async () => {
      const answer = (await callApi(app, { path: "/api/health" })) as {
        ok?: unknown;
        relay?: unknown;
      };
      last = JSON.stringify(answer);
      return answer.ok === true && answer.relay === "connected" ? answer : undefined;
    },
  }).catch((error: unknown) => {
    throw new Error(`${String(error)}; /api/health answered ${last}`);
  });
}

async function uiDocument(app: SmokeApp): Promise<void> {
  const page = await pageAt(app, "/");
  const isUi = page.status === 200 && page.body.includes('<div id="root">');
  expect(isUi, `/ answered ${String(page.status)} without the UI page`);
  const hasToken = page.body.includes('name="agentcontrol-token"');
  expect(hasToken, "the UI page has no token for the browser");
}

/** The script a built page loads, as its address names it (a hashed file under /assets). */
const scriptOf = (page: string): string | undefined =>
  /<script[^>]* src="(\/assets\/[^"]+)"/.exec(page)?.[1];

/** A first start serves the UI the release ships built, as a production build, with no Vite. */
async function uiAsset(app: SmokeApp): Promise<void> {
  const page = await pageAt(app, "/");
  const source = scriptOf(page.body);
  expect(source !== undefined, "the UI page loads no built script from /assets");
  const shipped = readFileSync(join(app.release, "resources/ui-template/dist/index.html"), "utf8");
  expect(
    scriptOf(shipped) === source,
    `the page's script ${String(source)} is not the shipped build's`,
  );
  const script = await pageAt(app, source ?? "");
  const isScript = script.status === 200 && script.type.includes("javascript");
  expect(isScript, `${String(source)} answered ${String(script.status)} ${script.type}`);
  const noDevServer = !page.body.includes("/@vite/client") && !page.body.includes("/src/main");
  expect(noDevServer, "the UI page loads Vite's development client or source modules");
}

function databaseMigrated(app: SmokeApp): Promise<void> {
  const journal = JSON.parse(readFileSync(migrationsJournal, "utf8")) as { entries: unknown[] };
  const db = new Database(join(app.dataDir, "state.db"), { readonly: true });
  const applied = db.query("SELECT count(*) AS n FROM __drizzle_migrations").get() as { n: number };
  const columns = db.query("PRAGMA table_info(sessions)").all() as { name: string }[];
  db.close();
  const wanted = journal.entries.length;
  expect(applied.n === wanted, `${String(applied.n)} of ${String(wanted)} migrations were applied`);
  const hasNewest = columns.some((column) => column.name === "kind");
  expect(hasNewest, "the sessions table lacks the newest column");
  return Promise.resolve();
}

export const steps: Step[] = [
  { name: "the app answers /api/health", run: health },
  { name: "the UI document loads", run: uiDocument },
  { name: "the UI is the shipped production build, and its script loads", run: uiAsset },
  { name: "the database was migrated", run: databaseMigrated },
  { name: "a session with the mock agent runs a turn", run: sessionRuns },
  {
    name: "an adapter is installed with the app's own runtime and its agent sees no internal variables",
    run: adapterRunsWithACleanEnvironment,
  },
  { name: "a terminal runs a command in a pseudo-terminal", run: terminalRuns },
  {
    name: "a Modify request fails typecheck, is fixed, builds and is promoted",
    run: modifyPromotes,
  },
  { name: "the promoted change is built and served as the newest build", run: builtUiServesChange },
  { name: "nothing was written into the shipped node_modules", run: leavesResourcesAlone },
];
