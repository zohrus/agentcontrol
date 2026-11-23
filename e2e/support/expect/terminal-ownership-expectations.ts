import { NO_SUCH_TERMINAL } from "../setup/relay-terminals.ts";

/** Each attempt failed with the relay's "no such terminal" error. */
export function expectEveryAttemptRefusedAsNoSuchTerminal(
  outcomes: Array<{ action: string; code: number | undefined }>,
): void {
  const accepted = outcomes.filter((outcome) => outcome.code !== NO_SUCH_TERMINAL);
  if (accepted.length > 0) {
    const names = accepted.map((outcome) => outcome.action).join(", ");
    throw new Error(
      `expected the relay to refuse every attempt as "no such terminal", but it did not refuse: ${names}`,
    );
  }
}
