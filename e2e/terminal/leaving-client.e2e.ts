import { afterEach, test } from "bun:test";
import { expectShellsRunning } from "../support/expect/terminal-left-behind-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  aRelayThatHoldsTerminalsBeforeTheirShellStarts,
  asksForATerminalAndHangsUp,
  waitsForTheRelayToCatchUp,
} from "../support/setup/terminal-left-behind.ts";

afterEach(cleanUpAfterTest);

test("a terminal that is asked for while its program leaves is never started", async () => {
  // ********************************************************************
  // ** GIVEN a relay that is about to start a shell for a program that asked for a terminal
  // ********************************************************************
  const held = await aRelayThatHoldsTerminalsBeforeTheirShellStarts();
  const session = await held.relay.user.startsSession({ prompt: "Add rate limiting" });
  await asksForATerminalAndHangsUp(held, session);

  // ********************************************************************
  // ** WHEN the program has left and only then does the relay go on
  // ********************************************************************
  await waitsForTheRelayToCatchUp(held);
  held.release();
  await waitsForTheRelayToCatchUp(held);

  // ********************************************************************
  // ** THEN no shell is running: it would have had nobody to end it
  // ********************************************************************
  expectShellsRunning(held.shell, 0);
});
