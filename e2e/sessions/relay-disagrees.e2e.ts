import { afterEach, test } from "bun:test";
import {
  expectTheRelayAndTheAppToBeSaidToDisagree,
  expectTheRelaysOwnWordsToBeKept,
} from "../support/expect/relay-build-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayThatStillWantsAPrompt } from "../support/setup/older-relay.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a relay that cannot read a request the app accepted is reported as a disagreement, not as zod's list", async () => {
  // ********************************************************************
  // ** GIVEN an app connected to a relay that still runs code that wants a prompt for every session
  // ********************************************************************
  const app = await startAppWithLocalWorkspace({ relayWire: aRelayThatStillWantsAPrompt });

  // ********************************************************************
  // ** WHEN the user creates a session and writes no prompt
  // ********************************************************************
  const outcome = await app.user.triesToCreateASessionWithoutAPrompt();

  // ********************************************************************
  // ** THEN the app says the relay and the app disagree, and what to do about it
  // ********************************************************************
  expectTheRelayAndTheAppToBeSaidToDisagree(outcome);
  // AND what the relay itself said is still available, apart from that message
  expectTheRelaysOwnWordsToBeKept(outcome, "baseBranch");
});
