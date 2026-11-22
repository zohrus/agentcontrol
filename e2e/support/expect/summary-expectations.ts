import type { SessionSummary } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { seesSession } from "./session-list.ts";

function describeRequests(summary: SessionSummary): string {
  const commands = summary.pendingPermissions.map(
    (request) => request.toolCall.command ?? request.toolCall.title,
  );
  return commands.length === 0 ? "no request" : `requests for ${commands.join(", ")}`;
}

/** The session's list row holds one pending request to run exactly this command, with its options. */
export async function expectListedWithRequestToRunCommand(
  relay: RelayAccess,
  call: { session: Session; command: string },
): Promise<void> {
  const { session, command } = call;
  const summary = await seesSession(relay, session);
  const expectation = `expected the list row of session "${session.title}" to hold a request to run \`${command}\``;
  const [request] = summary.pendingPermissions;
  if (summary.pendingPermissions.length !== 1 || request?.toolCall.command !== command) {
    throw new Error(`${expectation}, but it holds ${describeRequests(summary)}`);
  }
  const names = request.options.map((option) => `${option.name} (${option.kind})`).join(", ");
  if (names !== "Allow (allow_once), Reject (reject_once)") {
    throw new Error(`${expectation} offering Allow and Reject, but it offers: ${names}`);
  }
}

/** The session's list row holds no pending request. */
export async function expectListedWithNoPendingRequest(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  const summary = await seesSession(relay, session);
  if (summary.pendingPermissions.length > 0) {
    throw new Error(
      `expected the list row of session "${session.title}" to hold no request, but it holds ${describeRequests(summary)}`,
    );
  }
}

/** The session's list row says whether a turn is running. */
export async function expectListedAsTurnRunning(
  relay: RelayAccess,
  call: { session: Session; running: boolean },
): Promise<void> {
  const { session, running } = call;
  const summary = await seesSession(relay, session);
  if (summary.turnRunning !== running) {
    const expected = running ? "a turn running" : "no turn running";
    throw new Error(
      `expected the list row of session "${session.title}" to show ${expected}, but it shows ${running ? "none" : "one"} (status ${summary.status})`,
    );
  }
}
