import { ErrorCode } from "@agentcontrol/protocol";
import type { Refusal } from "../setup/relay-terminals.ts";

/** The relay refused because the session was archived. */
export function expectRefusedBecauseArchived(refusal: Refusal | undefined): void {
  if (refusal?.code !== ErrorCode.sessionArchived) {
    const seen = refusal === undefined ? "opened one" : `answered "${refusal.message}"`;
    throw new Error(
      `expected the relay to refuse a terminal of an archived session, but it ${seen}`,
    );
  }
}

/** The relay stopped at this many terminals and said so in words. */
export function expectAtMostTerminals(
  result: { allowed: number; refusal: Refusal | undefined },
  limit: number,
): void {
  const said = result.refusal?.message ?? "nothing";
  if (result.allowed !== limit || !/at most/i.test(said)) {
    throw new Error(
      `expected the relay to allow ${String(limit)} terminals and then say "at most ${String(limit)}", but it allowed ${String(result.allowed)} and said "${said}"`,
    );
  }
}

/** The relay could not start a shell and said so. */
export function expectRefusedBecauseNoShellCouldStart(refusal: Refusal | undefined): void {
  const said = refusal?.message ?? "nothing: it opened one";
  if (!/could not start a shell/i.test(said)) {
    throw new Error(`expected the relay to say it could not start a shell, but it said "${said}"`);
  }
}
