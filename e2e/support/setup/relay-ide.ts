import { ErrorCode, RelayName as N } from "@agentcontrol/protocol";
import { RelayCallError, type RelayClient } from "./relay-client.ts";
import type { Session } from "./relay.ts";
import { FAKE_CODE_SERVER_ENV } from "./ide-setups.ts";
import { type RunningRelay, startRelayWithLocalRepo } from "./start-relay.ts";

const BROWSER_HEADERS: [string, string][] = [["host", "127.0.0.1:1"]];

/** How the relay refused a call: its error code, or undefined when it did not refuse. */
async function refusalOf(attempt: Promise<unknown>): Promise<number | undefined> {
  const failure = await attempt.then(
    () => undefined,
    (error: unknown) => error,
  );
  return failure instanceof RelayCallError ? failure.code : undefined;
}

/** The app opens a WebSocket into the session's code-server, under this tunnel id. */
function opensSocketThrough(
  relay: RunningRelay,
  call: { session: Session; tunnelId: string },
): Promise<unknown> {
  return relay.call(N.ideSocketOpen, {
    sessionId: call.session.id,
    tunnelId: call.tunnelId,
    path: "/socket",
    headers: BROWSER_HEADERS,
    protocols: [],
  });
}

/** Another program that knows the tunnel's id sends into it; how the relay answered. */
export function sendsIntoSocketOf(
  program: RelayClient,
  tunnelId: string,
): Promise<number | undefined> {
  return refusalOf(program.call(N.ideSocketSend, { tunnelId, data: "", binary: false }));
}

/** Opens a socket under an id that is already in use; how the relay answered. */
export function opensSocketUnderUsedId(
  relay: RunningRelay,
  call: { session: Session; tunnelId: string },
): Promise<number | undefined> {
  return refusalOf(opensSocketThrough(relay, call));
}

/** Asks the relay to start the session's code-server; how it answered when it refused. */
export function startsCodeServer(
  relay: RunningRelay,
  session: Session,
): Promise<number | undefined> {
  return refusalOf(relay.call(N.ideStart, { sessionId: session.id }));
}

/** Stops the session's code-server through the relay's own method. */
export async function stopsCodeServer(relay: RunningRelay, session: Session): Promise<void> {
  await relay.call(N.ideStop, { sessionId: session.id });
}

/** Whether the relay says a code-server runs for the session. */
export async function codeServerRunsFor(relay: RunningRelay, session: Session): Promise<boolean> {
  return (await relay.call(N.ideStatus, { sessionId: session.id })).running;
}

export const REFUSED_AS_INVALID = ErrorCode.invalidParams;
export const REFUSED_AS_NOT_INSTALLED = ErrorCode.ideNotInstalled;

/** A relay with code-server and a session, whose WebSocket into code-server the app opened as "mine". */
export async function startsRelayWithAnOpenSocket(): Promise<{
  relay: RunningRelay;
  session: Session;
}> {
  const relay = await startRelayWithLocalRepo({ env: FAKE_CODE_SERVER_ENV });
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  await opensSocketThrough(relay, { session, tunnelId: "mine" });
  return { relay, session };
}
