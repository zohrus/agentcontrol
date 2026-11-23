import { afterEach, test } from "bun:test";
import { expectEveryAttemptRefusedAsNoSuchTerminal } from "../support/expect/terminal-ownership-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  anotherProgramOf,
  openTerminalOnRelay,
  triesToReach,
} from "../support/setup/relay-terminals.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";
import { SHELL_RELAY_ENV } from "../support/setup/start-app-with-shell.ts";

afterEach(cleanUpAfterTest);

test("another program connected to the relay cannot use a terminal it did not open", async () => {
  // ********************************************************************
  // ** GIVEN a session whose terminal was opened by the app
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: SHELL_RELAY_ENV });
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  const terminalId = await openTerminalOnRelay(relay, session);

  // ********************************************************************
  // ** WHEN another program that knows the terminal's id tries to type into, resize and close it
  // ********************************************************************
  const outcomes = await triesToReach(anotherProgramOf(relay), terminalId);

  // ********************************************************************
  // ** THEN every attempt is refused as if there were no such terminal
  // ********************************************************************
  expectEveryAttemptRefusedAsNoSuchTerminal(outcomes);
});
