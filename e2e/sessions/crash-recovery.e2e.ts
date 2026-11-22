import { afterEach, test } from "bun:test";
import {
  expectSessionHistoryToBeReplayed,
  expectSessionListedAs,
  expectSessionWaitingForApproval,
  expectSessionWaitingForSetupFix,
} from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  relayIsKilledDuringSetup,
  relayIsKilledMidWrite,
  relayIsKilledWhileTheAgentWorks,
} from "../support/setup/relay-crashes.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

async function startSessionWaitingForApproval() {
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);
  return { relay, session };
}

test("after the relay was killed during a session's setup, the session waits for a setup fix", async () => {
  // ********************************************************************
  // ** GIVEN a session whose setup was still running when the relay was killed
  // ********************************************************************
  const { relay, session } = await startSessionWaitingForApproval();

  // ********************************************************************
  // ** WHEN the relay starts again and the app follows the session from its start
  // ********************************************************************
  await relayIsKilledDuringSetup(relay, session);
  await relay.followsSessionAfter(session, 0);

  // ********************************************************************
  // ** THEN the session is listed as waiting for a setup fix
  // ********************************************************************
  await expectSessionWaitingForSetupFix(relay, session);
});

test("after the relay was killed while the agent worked, the session is listed as failed", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent was working when the relay was killed
  // ********************************************************************
  const { relay, session } = await startSessionWaitingForApproval();

  // ********************************************************************
  // ** WHEN the relay starts again
  // ********************************************************************
  await relayIsKilledWhileTheAgentWorks(relay, session);

  // ********************************************************************
  // ** THEN the session is listed as failed
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "failed" });
});

test("a log whose last line was cut off by a crash is repaired and its history replays", async () => {
  // ********************************************************************
  // ** GIVEN a session whose log ends in the middle of an event, because the relay was killed
  // ********************************************************************
  const { relay, session } = await startSessionWaitingForApproval();
  await relayIsKilledMidWrite(relay, session);

  // ********************************************************************
  // ** WHEN the app follows the session from its start
  // ********************************************************************
  await relay.followsSessionAfter(session, 0);

  // ********************************************************************
  // ** THEN the history before the cut is replayed
  // ********************************************************************
  await expectSessionHistoryToBeReplayed(relay, session);
  // AND the session is listed as failed
  await expectSessionListedAs(relay, { session, status: "failed" });
});
