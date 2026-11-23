import type { SessionSummary } from "@agentcontrol/protocol";
import type { ModifyState, SessionEvent } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

const WAIT_MS = 45_000;

async function waitForStatus(app: AppAccess, status: ModifyState["status"]): Promise<ModifyState> {
  let last: ModifyState | undefined;
  const expectation = `expected the Modify agent to be ${status}`;
  await eventually(
    expectation,
    async () => {
      last = await app.sdk.modify.state();
      return last.status === status ? undefined : `it is ${last.status}: ${last.failure ?? ""}`;
    },
    WAIT_MS,
  );
  return last as ModifyState;
}

/** The change passed the checks, is in the live UI and waits for Keep or Undo. */
export async function expectUiChangeReadyToKeep(app: AppAccess): Promise<ModifyState> {
  const state = await waitForStatus(app, "ready");
  if (state.gate !== "ready")
    throw new Error(`expected the gate to be ready, but it is ${state.gate}`);
  return state;
}

/** The Modify agent gave up; the state says why in words. */
export function expectUiChangeFailed(app: AppAccess): Promise<ModifyState> {
  return waitForStatus(app, "failed");
}

/** Nothing is being changed and nothing waits for Keep or Undo. */
export function expectNoChangeInProgress(app: AppAccess): Promise<ModifyState> {
  return waitForStatus(app, "idle");
}

/** The relay lists a Modify agent session (a directory session), and none of them is still running. */
export function expectNoModifyAgentLeftRunning(sessions: SessionSummary[]): Promise<void> {
  const modify = sessions.filter((session) => session.kind === "directory");
  const running = modify.filter((session) => session.archivedAt === undefined);
  if (modify.length === 0 || running.length > 0) {
    throw new Error(
      `expected the Modify agent's session to be ended, but the relay lists ${String(running.length)} of ${String(modify.length)} Modify sessions as still open`,
    );
  }
  return Promise.resolve();
}

const describeVersion = (version: { kind: string; message: string } | undefined): string =>
  version ? `${version.kind} "${version.message}"` : "nothing";

/** The newest kept version is a change whose message is the user's request. */
export async function expectUiVersionKept(
  app: AppAccess,
  expected: { request: string },
): Promise<void> {
  const [newest] = await app.sdk.modify.history();
  if (describeVersion(newest) !== `change "${expected.request}"`) {
    throw new Error(
      `expected the newest UI version to be the change "${expected.request}", but it is ${describeVersion(newest)}`,
    );
  }
}

async function modifySessionEvents(app: AppAccess): Promise<SessionEvent[]> {
  const { sessionId } = await app.sdk.modify.state();
  if (!sessionId) return [];
  return app.sdk.sessions.events(sessionId, { after: 0 });
}

/** The Modify agent was told what the compiler said (a later prompt of the same session). */
export async function expectModifyAgentToldAbout(app: AppAccess, text: string): Promise<void> {
  const prompts = (await modifySessionEvents(app)).filter((event) => event.kind === "prompt-sent");
  const told = prompts.some((event) => event.payload.text.includes(text));
  if (!told) throw new Error(`expected the Modify agent to be sent "${text}", but it never was`);
}

/** How many times the Modify agent was prompted (first request plus fixes). */
export async function expectModifyAgentPromptedTimes(app: AppAccess, times: number): Promise<void> {
  const prompts = (await modifySessionEvents(app)).filter((event) => event.kind === "prompt-sent");
  if (prompts.length !== times) {
    throw new Error(
      `expected the Modify agent to be prompted ${String(times)} times, but it was ${String(prompts.length)}`,
    );
  }
}

type Permission = Extract<SessionEvent, { kind: "permission-requested" | "permission-answered" }>;

/** Whether the request that mentions `mention` was answered with a rejection by the relay itself. */
function refusedByRelay(events: SessionEvent[], mention: string): boolean {
  const request = events.find(
    (event) =>
      event.kind === "permission-requested" &&
      JSON.stringify(event.payload.toolCall).includes(mention),
  );
  const answer = events.find(
    (event): event is Permission =>
      event.kind === "permission-answered" &&
      request?.kind === "permission-requested" &&
      event.payload.requestId === request.payload.requestId,
  );
  const rejected = answer?.kind === "permission-answered" && "optionId" in answer.payload;
  return rejected && answer.payload.automatic !== undefined;
}

/** The relay refused a request of the Modify agent by itself, and the log says so and why. */
export async function expectModifyRequestRefusedAutomatically(
  app: AppAccess,
  expected: { toolCallMentions: string },
): Promise<void> {
  const mention = expected.toolCallMentions;
  const events = await eventuallyEvents(app, mention);
  if (!refusedByRelay(events, mention)) {
    const log = JSON.stringify(events.filter((e) => e.kind.startsWith("permission")));
    throw new Error(
      `expected the request mentioning "${mention}" to be refused automatically, but the log shows ${log}`,
    );
  }
}

async function eventuallyEvents(app: AppAccess, mention: string): Promise<SessionEvent[]> {
  let events: SessionEvent[] = [];
  await eventually(
    `expected the Modify agent's request mentioning "${mention}" to be answered`,
    async () => {
      events = await modifySessionEvents(app);
      const answers = events.filter((event) => event.kind === "permission-answered");
      return answers.length > 0 ? undefined : "no permission request was answered";
    },
    WAIT_MS,
  );
  return events;
}

/** The recovery page names the version, with a Restore button, and shows the Undo button. */
export function expectSafePageToList(page: string, message: string): void {
  if (!page.includes(message) || !page.includes("Restore")) {
    throw new Error(
      `expected the recovery page to list the version "${message}" with a Restore button, but it shows: ${page.slice(0, 400)}`,
    );
  }
}

/** The change waiting for Keep includes this file. */
export function expectChangedFilesToInclude(state: ModifyState, path: string): void {
  if (!state.changedFiles.includes(path)) {
    throw new Error(
      `expected the changed files to include ${path}, but they are: ${state.changedFiles.join(", ")}`,
    );
  }
}

/** The failure is explained in plain words and shows the compiler's output. */
export function expectFailureExplained(state: ModifyState, compilerCode: string): void {
  const explained =
    state.failure?.includes("nothing was changed") && state.checkOutput?.includes(compilerCode);
  if (!explained) {
    throw new Error(
      `expected a plain failure with ${compilerCode} in the check output, but: ${JSON.stringify(state)}`,
    );
  }
}

/** The change waiting for Keep or Undo is an update, and its summary says this. */
export async function expectUpdateSummary(app: AppAccess, text: string): Promise<void> {
  const state = await app.sdk.modify.state();
  const merged = state.update?.phase === "merged";
  if (!merged || !state.summary?.includes(text)) {
    throw new Error(
      `expected the update summary to say "${text}", but the state is ${JSON.stringify(state)}`,
    );
  }
}

/** The Modify agent's session is listed as a directory session, so the UI can hide it. */
export async function expectModifySessionListedAsDirectory(app: AppAccess): Promise<void> {
  const { sessionId } = await app.sdk.modify.state();
  const kind = sessionId ? ((await app.sdk.sessions.get(sessionId)).kind ?? "worktree") : "missing";
  if (kind !== "directory") {
    throw new Error(`expected the Modify session to be a directory session, but it is ${kind}`);
  }
}
