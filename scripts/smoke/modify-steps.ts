// The smoke steps that change the UI through the Modify agent of the compiled app: the shipped
// TypeScript and Vite must run, from the shipped node_modules, with no `bun` on PATH.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { callApi, waitUntil } from "./api.ts";
import type { SmokeApp } from "./app-process.ts";
import { expect, pageAt, writeScript } from "./check.ts";

const typeError = "export const smokeNote: number = 'not a number';\n";
const fixed = "export const smokeNote: string = 'hello from the smoke test';\n";

interface ModifyState {
  status: string;
  sessionId?: string;
  changedFiles: string[];
  failure?: string;
  checkOutput?: string;
}

const readState = (app: SmokeApp) => callApi(app, { path: "/api/modify" }) as Promise<ModifyState>;

async function asksForTheNote(app: SmokeApp): Promise<ModifyState> {
  const write = (content: string) => ({ kind: "writeFile", path: "src/smoke-note.ts", content });
  const done = { kind: "finish", stopReason: "end_turn" };
  await writeScript(app, [
    [write(typeError), done],
    [write(fixed), done],
  ]);
  const body = { request: "add a smoke note" };
  await callApi(app, { method: "POST", path: "/api/modify", body });
  return waitUntil({
    what: "the change to pass the checks",
    seconds: 600,
    read: async () => {
      const now = await readState(app);
      return now.status === "ready" || now.status === "failed" ? now : undefined;
    },
  });
}

/** The first version had a type error: the agent must have been sent tsc's output about it. */
async function typecheckWasReported(app: SmokeApp, state: ModifyState): Promise<void> {
  const path = `/api/sessions/${state.sessionId ?? ""}/events?after=0`;
  type Events = { events: { kind: string; payload: { text?: string } }[] };
  const { events } = (await callApi(app, { path })) as Events;
  const feedback = events.find(
    (event) => event.kind === "prompt-sent" && event.payload.text?.includes("typecheck failed"),
  );
  expect(
    feedback?.payload.text?.includes("error TS") === true,
    "the agent was not sent a TypeScript error",
  );
}

export async function modifyPromotes(app: SmokeApp): Promise<void> {
  const state = await asksForTheNote(app);
  const output = `${state.failure ?? ""}\n${state.checkOutput ?? ""}`;
  expect(state.status === "ready", `the change ended as ${state.status}: ${output}`);
  expect(state.changedFiles.includes("src/smoke-note.ts"), "the changed file is not listed");
  const live = readFileSync(join(app.dataDir, "ui/src/smoke-note.ts"), "utf8");
  expect(live === fixed, "the live UI does not hold the fixed file");
  await typecheckWasReported(app, state);
}

export async function viteServesChange(app: SmokeApp): Promise<void> {
  let last = "nothing yet";
  await waitUntil({
    what: `the UI server to serve the changed file (last answer: ${last})`,
    seconds: 60,
    read: async () => {
      const page = await pageAt(app, "/src/smoke-note.ts");
      last = `${String(page.status)} ${page.type}: ${page.body.slice(0, 200)}`;
      return page.body.includes("hello from the smoke test") ? page : undefined;
    },
  }).catch((error: unknown) => {
    throw new Error(`${String(error)}; last answer was ${last}`);
  });
}

export function leavesResourcesAlone(app: SmokeApp): Promise<void> {
  const modules = join(app.release, "resources/ui-template/node_modules");
  const wrote = [".vite", ".vite-temp"].some((name) => existsSync(join(modules, name)));
  expect(!wrote, "the app wrote a cache into the shipped node_modules");
  return Promise.resolve();
}
