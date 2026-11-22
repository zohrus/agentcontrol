import type { SessionEvent, SessionRow } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "../setup/app.ts";
import type { SaveOutcome } from "../setup/app-user.ts";
import { eventually } from "../setup/eventually.ts";
import { updatesOf } from "../setup/updates.ts";

function describeStatus(summary: SessionRow): string {
  const reasons = { permission: "approval", reply: "a reply", "setup-failed": "a setup fix" };
  const reason = summary.waitingReason;
  return reason ? `waiting for ${reasons[reason]}` : summary.status;
}

async function listedSession(app: AppAccess, session: Session): Promise<SessionRow | undefined> {
  const sessions = await app.sdk.sessions.list();
  return sessions.find((candidate) => candidate.id === session.id);
}

async function expectListedAs(
  app: AppAccess,
  call: { session: Session; wanted: string },
): Promise<void> {
  const { session, wanted } = call;
  await eventually(`expected session "${session.title}" to be ${wanted}`, async () => {
    const listed = await listedSession(app, session);
    if (!listed) return "it is not listed";
    return describeStatus(listed) === wanted ? undefined : `it is ${describeStatus(listed)}`;
  });
}

/** The session list shows the session waiting for the user's approval. */
export function expectSessionWaitingForApproval(app: AppAccess, session: Session): Promise<void> {
  return expectListedAs(app, { session, wanted: "waiting for approval" });
}

/** The session list shows the session waiting for the user's next message. */
export function expectSessionWaitingForReply(app: AppAccess, session: Session): Promise<void> {
  return expectListedAs(app, { session, wanted: "waiting for a reply" });
}

/** The session list shows the session as idle: its last turn was cancelled and nothing runs. */
export function expectSessionIdle(app: AppAccess, session: Session): Promise<void> {
  return expectListedAs(app, { session, wanted: "idle" });
}

function commandAsked(events: SessionEvent[]): string | undefined {
  const request = events.find((event) => event.kind === "permission-requested");
  return request?.kind === "permission-requested" ? request.payload.tool?.title : undefined;
}

/** The session's recorded history holds a request to run exactly this command. */
export async function expectApprovalRequestToRunCommand(
  app: AppAccess,
  call: { session: Session; command: string },
): Promise<void> {
  const { session, command } = call;
  await eventually(`expected the pending request to run \`${command}\``, async () => {
    const asked = commandAsked(await app.sdk.sessions.events(session.id));
    return asked === `Run ${command}` ? undefined : `it asks: ${asked ?? "nothing"}`;
  });
}

const isAgentReplyWith = (session: Session, text: string) => (event: SessionEvent) =>
  event.sessionId === session.id &&
  updatesOf(event).some((update) => update.type === "agent-text" && update.text.includes(text));

/** The live stream delivered the agent's reply as it happened. */
export async function expectLiveStreamDeliveredAgentReply(
  app: AppAccess,
  call: { session: Session; text: string },
): Promise<void> {
  await app.streamed.waitFor(
    isAgentReplyWith(call.session, call.text),
    `expected the live stream to deliver the agent's reply "${call.text}"`,
  );
}

function seqProblem(events: SessionEvent[]): string | undefined {
  const seqs = events.map((event) => event.seq);
  const wanted = seqs.map((_, index) => index + 1);
  return JSON.stringify(seqs) === JSON.stringify(wanted)
    ? undefined
    : `the history has sequence numbers ${seqs.join(", ")}`;
}

function continuationProblem(call: {
  before: SessionEvent[];
  now: SessionEvent[];
}): string | undefined {
  const { before, now } = call;
  if (now.length <= before.length) return "no new events arrived yet";
  if (now.at(-1)?.kind !== "turn-ended") return "the agent has not finished its turn yet";
  const kept = JSON.stringify(now.slice(0, before.length)) === JSON.stringify(before);
  return kept ? seqProblem(now) : "the earlier history changed";
}

/** Earlier history is untouched and new events follow it with no gap and no duplicate. */
export async function expectHistoryContinuesWithoutGaps(
  app: AppAccess,
  call: { session: Session; after: SessionEvent[] },
): Promise<void> {
  const { session, after: before } = call;
  const expectation = `expected the history of session "${session.title}" to continue after event ${String(before.length)} without gaps or repeats`;
  await eventually(expectation, async () =>
    continuationProblem({ before, now: await app.sdk.sessions.events(session.id) }),
  );
}

/** The session is listed under archived sessions, and no longer among the active ones. */
export async function expectSessionArchived(app: AppAccess, session: Session): Promise<void> {
  await eventually(`expected session "${session.title}" to be archived`, async () => {
    const archived = await app.sdk.sessions.list({ archived: true });
    const active = await app.sdk.sessions.list({ archived: false });
    if (!archived.some((listed) => listed.id === session.id)) return "it is not archived";
    return active.some((listed) => listed.id === session.id) ? "it is still active" : undefined;
  });
}

/** The save was refused because the file changed since it was read, and the app named its hash. */
export function expectSaveRefusedAsConflict(outcome: SaveOutcome, path: string): void {
  const expectation = `expected saving "${path}" from an out-of-date view to be refused as a conflict`;
  if (outcome.saved) throw new Error(`${expectation}, but it was saved`);
  if (outcome.status !== 409 || outcome.currentHash === undefined) {
    throw new Error(
      `${expectation}, but the app answered ${String(outcome.status)} ${outcome.code}`,
    );
  }
}

/** The file on disk in the session's worktree has this content. */
export async function expectFileContent(
  app: AppAccess,
  call: { session: Session; path: string; content: string },
): Promise<void> {
  const { session, path, content } = call;
  const file = await app.sdk.files.read({ id: session.id, path });
  if (file.content !== content) {
    throw new Error(
      `expected "${path}" to contain ${JSON.stringify(content)}, but it contains ${JSON.stringify(file.content)}`,
    );
  }
}
