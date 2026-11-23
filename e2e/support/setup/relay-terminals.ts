import { ErrorCode, RelayName as N, type TerminalId } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { RelayCallError, type RelayClient } from "./relay-client.ts";
import type { Session } from "./relay.ts";
import type { RunningRelay } from "./start-relay.ts";

/** The first client opens a terminal on the session; the id is what only that client knows. */
export async function openTerminalOnRelay(
  relay: RunningRelay,
  session: Session,
): Promise<TerminalId> {
  const { terminalId } = await relay.call(N.terminalOpen, {
    sessionId: session.id,
    cols: 80,
    rows: 24,
  });
  return terminalId;
}

/** A second program connected to the same relay; it is disconnected when the test ends. */
export function anotherProgramOf(relay: RunningRelay): RelayClient {
  const other = relay.connectsAnotherClient();
  onTestEnd(() => other.disconnect());
  return other;
}

/** What each way of reaching a terminal answered when the program was not its owner. */
export async function triesToReach(
  program: RelayClient,
  terminalId: TerminalId,
): Promise<Array<{ action: string; code: number | undefined }>> {
  const attempts = {
    "type into it": () => program.call(N.terminalWrite, { terminalId, data: "echo mine\n" }),
    "resize it": () => program.call(N.terminalResize, { terminalId, cols: 10, rows: 10 }),
    "close it": () => program.call(N.terminalClose, { terminalId }),
  };
  return Promise.all(
    Object.entries(attempts).map(async ([action, attempt]) => {
      const failure = await attempt().then(
        () => undefined,
        (error: unknown) => error,
      );
      return { action, code: failure instanceof RelayCallError ? failure.code : undefined };
    }),
  );
}

export const NO_SUCH_TERMINAL = ErrorCode.terminalNotFound;
