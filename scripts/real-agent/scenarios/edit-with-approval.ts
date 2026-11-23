import type { SessionEvent, SessionId, SessionRow } from "../../../packages/sdk/src/index.ts";
import type { Run } from "../scenario.ts";
import {
  answersWith,
  describeCounts,
  describeRequest,
  otherNames,
  requestOf,
  updatesOf,
  waitsForApproval,
  waitsForReply,
} from "../steps.ts";
import { expectThat, waitFor } from "../wait.ts";

const EDIT_PROMPT =
  'Use the Edit tool on greeting.js to change "Hello, world" to "Hello, agent". ' +
  "Do not run shell commands and do not read other files. Then reply in one short sentence.";

/** Allows every request until the turn ends; returns the requests that were asked. */
async function allowsUntilTheTurnEnds(run: Run, row: SessionRow): Promise<SessionRow[]> {
  const asked: SessionRow[] = [];
  let current = row;
  while (current.pendingPermissions.length > 0) {
    asked.push(current);
    await answersWith(run.world, { id: current.id, row: current, kind: "allow_once" });
    current = await waitsForNextStop(run, current);
  }
  return asked;
}

/** After an answer: the next request, or the end of the turn. */
function waitsForNextStop(run: Run, before: SessionRow): Promise<SessionRow> {
  const requestId = before.pendingPermissions[0]?.requestId;
  return run.world.waitsForSession({
    id: before.id,
    describe: "the next request or the end of the turn",
    when: (row) =>
      row.status === "failed" ||
      row.waitingReason === "reply" ||
      (row.pendingPermissions.length > 0 && row.pendingPermissions[0]?.requestId !== requestId),
  });
}

const isNotification = (message: object): boolean => "method" in message && !("id" in message);

function isSilentNotification(event: SessionEvent): boolean {
  if (event.kind !== "acp" || event.payload.direction !== "from-agent") return false;
  return isNotification(event.payload.message) && (event.payload.updates ?? []).length === 0;
}

/** Messages from the agent that are notifications but arrived with no update at all. */
function silentNotifications(events: SessionEvent[]): SessionEvent[] {
  return events.filter(isSilentNotification);
}

function noteUpdates(run: Run, events: SessionEvent[]): void {
  const messages = events.filter((event) => event.kind === "acp");
  run.note(`${String(messages.length)} ACP messages, ${String(updatesOf(events).length)} updates`);
  run.note(`other updates: ${describeCounts(otherNames(events))}`);
  const silent = silentNotifications(events).length;
  expectThat(silent === 0, `expected an update for every message, ${String(silent)} had none`);
}

/** The live stream delivered every event the history holds. */
async function expectStreamMatchesHistory(run: Run, events: SessionEvent[]): Promise<void> {
  const last = events.at(-1)?.seq ?? 0;
  const { streamed } = run.world.app;
  await waitFor({
    describe: "the live stream to deliver the last event",
    read: () => Promise.resolve(streamed.entries.find((event) => event.seq === last)),
    timeoutMs: 10_000,
  });
  const seen = streamed.entries.filter((event) => event.sessionId === events[0]?.sessionId);
  expectThat(
    seen.length === events.length,
    `expected ${String(events.length)} streamed events, got ${String(seen.length)}`,
  );
}

async function expectDiffListsTheFile(run: Run, id: SessionId): Promise<void> {
  const diff = await run.world.app.sdk.sessions.diff(id);
  const listed = diff.files.map((file) => file.path);
  expectThat(
    listed.includes("greeting.js"),
    `expected the diff to list greeting.js, it lists ${listed.join(", ") || "nothing"}`,
  );
}

/** Allows what the agent asks, then checks it asked to edit the file. */
async function approvesTheEdit(run: Run, first: SessionRow): Promise<void> {
  expectThat(
    first.status === "waiting" && first.waitingReason === "permission",
    `expected the session to wait for approval, it is ${first.status}`,
  );
  const asked = await allowsUntilTheTurnEnds(run, first);
  asked.forEach((row) => {
    run.note(describeRequest(row));
  });
  const edit = asked.some((row) => requestOf(row).toolCall.kind === "edit");
  expectThat(edit, "expected the agent to ask permission for an edit");
}

/** (a) A session edits one line: approval is asked, allowing finishes the turn, the diff has the file. */
export async function editWithApproval(run: Run): Promise<void> {
  const { world, flow } = run;
  const id = await world.startsSession(EDIT_PROMPT);
  flow.sessionId = id;
  await approvesTheEdit(run, await waitsForApproval(world, id));
  const finished = await waitsForReply(world, id);
  expectThat(
    !finished.turnRunning && finished.pendingPermissions.length === 0,
    "expected a finished turn with nothing pending",
  );
  const events = await world.eventsOf(id);
  noteUpdates(run, events);
  await expectStreamMatchesHistory(run, events);
  await expectDiffListsTheFile(run, id);
}
