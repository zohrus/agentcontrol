import { join } from "node:path";
import { RelayName, type SessionEvent, type SessionSummary } from "@agentcontrol/protocol";
import { z } from "zod";
import type { RelayAccess, Session } from "../setup/relay.ts";

const ToolCall = z.object({ title: z.string() });

const forSession = (session: Session, kind: SessionEvent["kind"]) => (event: SessionEvent) =>
  event.sessionId === session.id && event.kind === kind;

function describeStatus(summary: SessionSummary): string {
  const reasons = { permission: "approval", reply: "a reply", "setup-failed": "a setup fix" };
  const reason = summary.waitingReason;
  return reason ? `waiting for ${reasons[reason]}` : summary.status;
}

async function seesSession(relay: RelayAccess, session: Session): Promise<SessionSummary> {
  const { sessions } = await relay.call(RelayName.sessionsList, {});
  const listed = sessions.find((candidate) => candidate.id === session.id);
  if (!listed) throw new Error(`expected session "${session.title}" to be listed, but it is not`);
  return listed;
}

async function expectListedAs(
  relay: RelayAccess,
  call: { session: Session; status: SessionSummary["status"]; reason: string; wanted: string },
): Promise<void> {
  const { session } = call;
  const summary = await seesSession(relay, session);
  if (summary.status === call.status && describeStatus(summary) === call.wanted) return;
  throw new Error(
    `expected session "${session.title}" to be ${call.wanted}, but it is ${describeStatus(summary)}`,
  );
}

/** The session list flags the session as waiting on the user's approval. */
export async function expectSessionWaitingForApproval(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  await relay.events.waitFor(
    forSession(session, "permission-requested"),
    `expected session "${session.title}" to be waiting for approval, but the agent never asked`,
  );
  await expectListedAs(relay, {
    session,
    status: "waiting",
    reason: "permission",
    wanted: "waiting for approval",
  });
}

/** The session list shows the session waiting for the user's next message. */
export async function expectSessionWaitingForReply(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  await relay.events.waitFor(
    forSession(session, "turn-ended"),
    `expected session "${session.title}" to be waiting for a reply, but the agent never finished its turn`,
  );
  await expectListedAs(relay, {
    session,
    status: "waiting",
    reason: "reply",
    wanted: "waiting for a reply",
  });
}

/** The session list shows the session waiting because its worktree setup failed. */
export async function expectSessionWaitingForSetupFix(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  await relay.events.waitFor(
    forSession(session, "setup-finished"),
    `expected session "${session.title}" to be waiting for a setup fix, but its setup never finished`,
  );
  await expectListedAs(relay, {
    session,
    status: "waiting",
    reason: "setup-failed",
    wanted: "waiting for a setup fix",
  });
}

/** The newest permission request of the session asks to run exactly this command. */
export async function expectPendingRequestToRunCommand(
  relay: RelayAccess,
  session: Session,
  command: string,
): Promise<void> {
  const request = await relay.events.waitFor(
    forSession(session, "permission-requested"),
    `expected session "${session.title}" to have a request to run \`${command}\`, but it has none`,
  );
  const asked =
    request.kind === "permission-requested" ? ToolCall.parse(request.payload.toolCall).title : "";
  if (asked !== `Run ${command}`) {
    throw new Error(`expected the pending request to run \`${command}\`, but it asks: "${asked}"`);
  }
}

/** The relay never launched the agent for this session (no `agent-started` event). */
export function expectAgentNotStarted(relay: RelayAccess, session: Session): void {
  const started = relay.events.entries.some(forSession(session, "agent-started"));
  if (started)
    throw new Error(`expected no agent to start for session "${session.title}", but one did`);
}

async function loggedSeqs(relay: RelayAccess, session: Session): Promise<number[]> {
  const file = join(relay.dataDir, "sessions", session.id, "events.jsonl");
  const lines = (await Bun.file(file).text()).split("\n").filter((line) => line !== "");
  return lines.map((line) => z.object({ seq: z.number() }).parse(JSON.parse(line)).seq);
}

/**
 * The app, following the session after `afterSeq`, received exactly the events the relay logged
 * after that point: none before it, none twice, none missing, up to the end of the agent's turn.
 */
export async function expectExactlyTheLaterEvents(
  relay: RelayAccess,
  call: { session: Session; afterSeq: number },
): Promise<void> {
  const { session, afterSeq } = call;
  await relay.events.waitFor(
    forSession(session, "turn-ended"),
    `expected the app to receive the events after ${String(afterSeq)} up to the end of the turn, but they never arrived`,
  );
  const received = relay.events.entries
    .filter((event) => event.sessionId === session.id)
    .map((event) => event.seq);
  const last = received.at(-1) ?? 0;
  const logged = (await loggedSeqs(relay, session)).filter((seq) => seq > afterSeq && seq <= last);
  if (JSON.stringify(received) !== JSON.stringify(logged)) {
    throw new Error(
      `expected the app to receive events ${logged.join(", ")} after ${String(afterSeq)}, but it received ${received.join(", ")}`,
    );
  }
}
