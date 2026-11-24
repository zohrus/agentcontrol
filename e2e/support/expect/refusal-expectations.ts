import { SCHEMA_REFUSAL } from "@agentcontrol/protocol";
import type { Outcome } from "../setup/attempt.ts";
import type { RelayAccess } from "../setup/relay.ts";

/** The relay refused the call with this error code and a message that says why. */
export function expectRefusal(
  outcome: Outcome<unknown>,
  wanted: { code: number; saying: string },
): void {
  if (outcome.ok) {
    throw new Error(`expected the relay to refuse (${wanted.saying}), but it accepted`);
  }
  const rightCode = outcome.code === wanted.code;
  if (!rightCode || !outcome.message.includes(wanted.saying)) {
    throw new Error(
      `expected a refusal with code ${String(wanted.code)} saying "${wanted.saying}", but got ${String(outcome.code)}: ${outcome.message}`,
    );
  }
}

/** The refusal says the parameters did not fit the schema, so that a client can tell it from a refusal of what they asked. */
export function expectRefusalToBeAboutTheSchema(outcome: Outcome<unknown>): void {
  if (outcome.ok) throw new Error("expected the relay to refuse the parameters, but it accepted");
  if (JSON.stringify(outcome.data) !== JSON.stringify(SCHEMA_REFUSAL)) {
    throw new Error(
      `expected the refusal to be marked as one about the schema, but its data is ${JSON.stringify(outcome.data)}`,
    );
  }
}

/** The second relay was not started, and its error says one is already running. */
export function expectSecondRelayToBeRefused(result: { started: boolean; message: string }): void {
  if (result.started) {
    throw new Error("expected a second relay on the same folder to be refused, but it started");
  }
  if (!result.message.includes("already running")) {
    throw new Error(
      `expected the refusal to say a relay is already running, but: ${result.message}`,
    );
  }
}

/** The relay answered a line it could not make sense of with this error code. */
export async function expectLineToBeAnsweredWithError(
  relay: RelayAccess,
  code: number,
): Promise<void> {
  await relay.unansweredErrors.waitFor(
    (error) => error.code === code,
    `expected the relay to answer the line with error ${String(code)}`,
  );
}
