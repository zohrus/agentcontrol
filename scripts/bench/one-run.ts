import { access } from "node:fs/promises";
import { join } from "node:path";
import type { SessionEvent, SessionId } from "../../packages/sdk/src/index.ts";
import type { RunningApp } from "../../e2e/support/setup/start-app.ts";

/** One number per row of the tables, in milliseconds. */
export type Rows = Record<string, number>;

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

const at = (event: SessionEvent | undefined): number =>
  event === undefined ? Number.NaN : Date.parse(event.ts);

function outputOf(events: SessionEvent[], text: string): SessionEvent | undefined {
  return events.find((e) => e.kind === "setup-output" && e.payload.text.includes(text));
}

/** What each part of starting took, from the session's events. */
function startRows(call: { events: SessionEvent[]; clickedAt: number; returned: number }): Rows {
  const { events, clickedAt } = call;
  const first = (kind: SessionEvent["kind"]) => events.find((e) => e.kind === kind);
  const trunkKnown = at(outputOf(events, "Started from"));
  const scriptBegins = at(outputOf(events, "begin"));
  const scriptEnds = at(first("setup-finished"));
  const ready = at(first("agent-started"));
  return {
    "start() returns": call.returned,
    "1. find the trunk and fetch": trunkKnown - at(first("session-created")),
    "2. checkout and copy files": scriptBegins - trunkKnown,
    "3. setup script": scriptEnds - scriptBegins,
    "4. agent: start, initialize, session/new (after the setup script)": ready - scriptEnds,
    "total: click to ready": ready - clickedAt,
  };
}

async function untilReady(read: () => Promise<SessionEvent[]>): Promise<SessionEvent[]> {
  for (;;) {
    const events = await read();
    if (events.some((e) => e.kind === "agent-started")) return events;
    if (events.some((e) => e.kind === "setup-finished" && e.payload.exitCode !== 0)) {
      throw new Error("the session could not be set up");
    }
    await Bun.sleep(50);
  }
}

async function untilGone(path: string, since: number): Promise<number> {
  while (await exists(path)) await Bun.sleep(10);
  return Math.round(performance.now() - since);
}

function trace(events: SessionEvent[], clickedAt: number): void {
  for (const e of events) {
    const note = e.kind === "setup-output" ? e.payload.text.trim() : "";
    console.log(`${String(at(e) - clickedAt).padStart(6)} ms  ${e.kind} ${note}`);
  }
}

export interface Run {
  started: Rows;
  archived: Rows;
  /** The lines of the steps the session said while starting, when it says any. */
  steps: string[];
}

/** Starts a session, waits until it is ready, archives it and waits until its folder is gone. */
export async function oneRun(call: {
  app: RunningApp;
  watch: boolean;
  trace: boolean;
}): Promise<Run> {
  const { app } = call;
  // The disk writes of the run before (50,000 files made, 50,000 deleted) would slow this one.
  Bun.spawnSync(["sync"]);
  await Bun.sleep(1000);
  const clickedAt = Date.now();
  const id: SessionId = await app.sdk.sessions.start({ agent: "mock", repoPath: app.repoPath });
  const returned = Date.now() - clickedAt;
  // The user has the session open: the Files tab asks for the tree, which starts the file watch.
  if (call.watch) await app.sdk.files.tree(id);
  const events = await untilReady(() => app.sdk.sessions.events(id, { after: 0 }));
  if (call.trace) trace(events, clickedAt);
  return {
    started: startRows({ events, clickedAt, returned }),
    archived: await archived(app, id),
    steps: events.flatMap((e) =>
      e.kind === "setup-output" && e.payload.step !== undefined ? [e.payload.text.trim()] : [],
    ),
  };
}

/** How long archiving took to answer, and to have the folder gone. */
async function archived(app: RunningApp, id: SessionId): Promise<Rows> {
  const began = performance.now();
  await app.sdk.sessions.archive(id);
  const returned = Math.round(performance.now() - began);
  const gone = await untilGone(join(app.dataDir, "relay", "worktrees", id), began);
  return { "archive() returns": returned, "the worktree's folder is gone": gone };
}
