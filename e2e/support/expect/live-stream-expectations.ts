import type { SessionRow } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "../setup/app.ts";
import type { LiveStream } from "../setup/live-stream.ts";

const isRowOf = (session: Session) => (row: SessionRow) => row.id === session.id;

/** The live stream pushed the session's row with a pending request to run exactly this command. */
export async function expectStreamPushedRequestToRunCommand(
  stream: LiveStream,
  call: { session: Session; command: string },
): Promise<void> {
  const { session, command } = call;
  await stream.sessions.waitFor(
    (row) =>
      isRowOf(session)(row) && row.pendingPermissions.some((r) => r.toolCall.command === command),
    `expected the live stream to push session "${session.title}" with a request to run \`${command}\``,
  );
}

/** The live stream pushed the session's row waiting for a reply, with no request left. */
export async function expectStreamPushedSessionWaitingForReply(
  stream: LiveStream,
  session: Session,
): Promise<void> {
  await stream.sessions.waitFor(
    (row) =>
      isRowOf(session)(row) &&
      row.waitingReason === "reply" &&
      row.pendingPermissions.length === 0 &&
      !row.turnRunning,
    `expected the live stream to push session "${session.title}" waiting for a reply with no request`,
  );
}

/** The live stream pushed the session's row with a turn running. */
export async function expectStreamPushedTurnRunning(
  stream: LiveStream,
  session: Session,
): Promise<void> {
  await stream.sessions.waitFor(
    (row) => isRowOf(session)(row) && row.turnRunning,
    `expected the live stream to push session "${session.title}" with a turn running`,
  );
}

/** The session's stored record shows its pending request and that its turn is still open. */
export async function expectRecordHoldsRequestToRunCommand(
  app: AppAccess,
  call: { session: Session; command: string },
): Promise<void> {
  const { session, command } = call;
  const record = await app.sdk.sessions.get(session.id);
  const asked = record.pendingPermissions.map((request) => request.toolCall.command);
  if (asked.join() !== command || !record.turnRunning) {
    throw new Error(
      `expected the record of session "${session.title}" to hold a request to run \`${command}\` in an open turn, but it holds ${asked.join() || "no request"} (turn running: ${String(record.turnRunning)})`,
    );
  }
}

function workspaceIdsHeard(stream: LiveStream, session: Session) {
  return {
    "a live event": stream.events.entries.find((e) => e.sessionId === session.id)?.workspaceId,
    "a live session row": stream.sessions.entries.find(isRowOf(session))?.workspaceId,
    "a live file change": stream.fileChanges.entries.find((c) => c.sessionId === session.id)
      ?.workspaceId,
  };
}

/** Every record and live message about the session names the same, non-empty workspace. */
export async function expectEveryMessageToNameTheWorkspace(
  app: AppAccess,
  call: { stream: LiveStream; session: Session },
): Promise<void> {
  const { stream, session } = call;
  const record = await app.sdk.sessions.get(session.id);
  const listed = (await app.sdk.sessions.list()).find((row) => row.id === session.id);
  const named = {
    "the session record": record.workspaceId,
    "the session list": listed?.workspaceId,
    ...workspaceIdsHeard(stream, session),
  };
  const unlike = Object.entries(named).filter(([, id]) => !id || id !== record.workspaceId);
  if (unlike.length > 0) {
    const seen = unlike.map(([what, id]) => `${what}: ${String(id)}`).join("; ");
    throw new Error(
      `expected every message about session "${session.title}" to name workspace "${record.workspaceId}", but ${seen}`,
    );
  }
}
