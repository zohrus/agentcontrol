// The smoke steps that change the UI through the Modify agent of the compiled app: the shipped
// TypeScript and Vite (which builds the change) must run, from the shipped node_modules, with no
// `bun` on PATH.
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/** The build the app serves is the one `/_ui-build` names: the newest of the builds in the data folder. */
export async function builtUiServesChange(app: SmokeApp): Promise<void> {
  const answer = await pageAt(app, "/_ui-build");
  const key = (JSON.parse(answer.body) as { mark: string }).mark.split("|")[0] ?? "";
  const builds = readdirSync(join(app.dataDir, "ui-build"));
  expect(builds.includes(key), `the build ${key} that is served is not among ${builds.join(", ")}`);
  // The shipped build was filed on the first start; the promoted change is the second.
  expect(
    builds.length === 2,
    `expected the shipped build and one new build, found ${builds.join(", ")}`,
  );
  const failed = (await pageAt(app, "/")).body.includes("could not be built");
  expect(!failed, "the page says the change could not be built");
}

export function leavesResourcesAlone(app: SmokeApp): Promise<void> {
  const modules = join(app.release, "resources/ui-template/node_modules");
  const wrote = [".vite", ".vite-temp"].some((name) => existsSync(join(modules, name)));
  expect(!wrote, "the app wrote a cache into the shipped node_modules");
  return Promise.resolve();
}
