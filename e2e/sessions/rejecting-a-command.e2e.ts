import { afterEach, test } from "bun:test";
import { expectSessionWaitingForApproval } from "../support/expect/session-expectations.ts";
import {
  expectNoCommandToHaveRun,
  expectTurnToEndWithStopReason,
} from "../support/expect/turn-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("when the user rejects a command the agent stops without running it", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will ask to run `rm -rf build`, then reply "Cleaned"
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("rm -rf build");
  relay.mockAgent.willReply("Cleaned");
  // AND the user has started a session that is waiting for approval
  const session = await relay.user.startsSession({ prompt: "Clean the build folder" });
  await expectSessionWaitingForApproval(relay, session);

  // ********************************************************************
  // ** WHEN the user rejects the command
  // ********************************************************************
  await relay.user.rejectsTheCommand(session);

  // ********************************************************************
  // ** THEN the agent's turn ends
  // ********************************************************************
  await expectTurnToEndWithStopReason(relay, { session, stopReason: "end_turn" });
  // AND the command was never run
  expectNoCommandToHaveRun(relay, session);
});
