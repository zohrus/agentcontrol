import type { Session } from "../setup/relay.ts";
import { codeServerRunsFor } from "../setup/relay-ide.ts";
import type { RunningRelay } from "../setup/start-relay.ts";

/** The relay refused with this JSON-RPC error code. */
export function expectRelayToRefuse(answer: number | undefined, code: number): void {
  if (answer !== code) {
    throw new Error(
      `expected the relay to refuse with code ${String(code)}, but it answered ${String(answer)}`,
    );
  }
}

/** The relay says a code-server does (or does not) run for the session. */
export async function expectCodeServerRunning(
  relay: RunningRelay,
  session: Session,
  running: boolean,
): Promise<void> {
  const says = await codeServerRunsFor(relay, session);
  if (says !== running) {
    throw new Error(
      `expected the relay to say a code-server ${running ? "runs" : "does not run"}, but it said the opposite`,
    );
  }
}
