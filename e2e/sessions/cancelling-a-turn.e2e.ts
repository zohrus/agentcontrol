import { afterEach, test } from "bun:test";
import { expectTurnToEndWithStopReason } from "../support/expect/turn-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("cancelling a running turn ends it with stop reason cancelled", async () => {
  // ********************************************************************
  // ** GIVEN an agent whose turn stays open until it is cancelled
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willWaitUntilCancelled();
  // AND the user has started a session
  const session = await relay.user.startsSession({ prompt: "Refactor everything" });

  // ********************************************************************
  // ** WHEN the user cancels the turn
  // ********************************************************************
  await relay.user.cancelsTheTurn(session);

  // ********************************************************************
  // ** THEN the turn ends with stop reason "cancelled"
  // ********************************************************************
  await expectTurnToEndWithStopReason(relay, { session, stopReason: "cancelled" });
});
