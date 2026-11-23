import { afterEach, test } from "bun:test";
import {
  expectSessionHistoryToBeReplayed,
  expectSessionListedAs,
  expectSessionWaitingForSetupFix,
} from "../support/expect/session-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  relayIsKilledDuringSetup,
  relayIsKilledMidWrite,
  relayIsKilledWhileTheAgentWorks,
} from "../support/setup/relay-crashes.ts";
import { startRelayWithSessionWaitingToRunNpmTest } from "../support/setup/relay-sessions.ts";

afterEach(cleanUpAfterTest);

test("after the relay was killed during a session's setup, the session waits for a setup fix", async () => {
  // ********************************************************************
  // ** GIVEN a session whose setup was still running when the relay was killed
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingToRunNpmTest();

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

test("after the relay was killed while the agent worked, the session is listed as interrupted", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent was working when the relay was killed
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingToRunNpmTest();

  // ********************************************************************
  // ** WHEN the relay starts again
  // ********************************************************************
  await relayIsKilledWhileTheAgentWorks(relay, session);

  // ********************************************************************
  // ** THEN the session is listed as interrupted
  // ********************************************************************
  await expectSessionListedAs(relay, { session, status: "interrupted" });
});

test("a log whose last line was cut off by a crash is repaired and its history replays", async () => {
  // ********************************************************************
  // ** GIVEN a session whose log ends in the middle of an event, because the relay was killed
  // ********************************************************************
  const { relay, session } = await startRelayWithSessionWaitingToRunNpmTest();
  await relayIsKilledMidWrite(relay, session);

  // ********************************************************************
  // ** WHEN the app follows the session from its start
  // ********************************************************************
  await relay.followsSessionAfter(session, 0);

  // ********************************************************************
  // ** THEN the history before the cut is replayed
  // ********************************************************************
  await expectSessionHistoryToBeReplayed(relay, session);
  // AND the session is listed as interrupted
  await expectSessionListedAs(relay, { session, status: "interrupted" });
});
