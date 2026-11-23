// The steps of the compiled-app smoke test, in order. Each throws a plain sentence when it fails.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { callApi } from "./api.ts";
import type { SmokeApp } from "./app-process.ts";
import { expect, type Step, pageAt } from "./check.ts";
import { leavesResourcesAlone, modifyPromotes, viteServesChange } from "./modify-steps.ts";
import { sessionRuns } from "./session-steps.ts";
import { terminalRuns } from "./terminal-step.ts";

const migrationsJournal = join(import.meta.dir, "../../packages/app/drizzle/meta/_journal.json");

async function health(app: SmokeApp): Promise<void> {
  const answer = (await callApi(app, { path: "/api/health" })) as { ok?: unknown; relay?: unknown };
  // The app is healthy only with its relay connected: a compiled app that cannot start its relay fails here.
  const healthy = answer.ok === true && answer.relay === "connected";
  expect(healthy, `/api/health answered ${JSON.stringify(answer)}`);
}

async function uiDocument(app: SmokeApp): Promise<void> {
  const page = await pageAt(app, "/");
  const isUi = page.status === 200 && page.body.includes('<div id="root">');
  expect(isUi, `/ answered ${String(page.status)} without the UI page`);
  const hasToken = page.body.includes('name="agentcontrol-token"');
  expect(hasToken, "the UI page has no token for the browser");
}

async function uiAsset(app: SmokeApp): Promise<void> {
  const script = await pageAt(app, "/src/main.tsx");
  const isScript = script.status === 200 && script.type.includes("javascript");
  expect(isScript, `/src/main.tsx answered ${String(script.status)} ${script.type}`);
  const client = await pageAt(app, "/@vite/client");
  expect(client.status === 200, `/@vite/client answered ${String(client.status)}`);
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
  { name: "a UI script and the hot-reload client load", run: uiAsset },
  { name: "the database was migrated", run: databaseMigrated },
  { name: "a session with the mock agent runs a turn", run: sessionRuns },
  { name: "a terminal runs a command in a pseudo-terminal", run: terminalRuns },
  {
    name: "a Modify request fails typecheck, is fixed, builds and is promoted",
    run: modifyPromotes,
  },
  { name: "the UI server serves the promoted file", run: viteServesChange },
  { name: "nothing was written into the shipped node_modules", run: leavesResourcesAlone },
];
