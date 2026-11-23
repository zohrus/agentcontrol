import { afterEach, test } from "bun:test";
import {
  expectRecordingsToBeFullyInterpreted,
  expectRecordingsToCoverTheSupportedKinds,
} from "../support/expect/recording-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  relayHoldsTheRealClaudeCodeRecordings,
  theAppFollowsTheRecordedSessions,
} from "../support/setup/real-recordings.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("sessions recorded from the real Claude Code adapter are served without uninterpreted updates", async () => {
  // ********************************************************************
  // ** GIVEN a relay holding event logs recorded from real Claude Code runs
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  const sessions = await relayHoldsTheRealClaudeCodeRecordings(relay);

  // ********************************************************************
  // ** WHEN the app follows every recorded session from its start
  // ********************************************************************
  await theAppFollowsTheRecordedSessions(relay, sessions);

  // ********************************************************************
  // ** THEN no message arrives as "other" except those left alone on purpose
  // ********************************************************************
  await expectRecordingsToBeFullyInterpreted(relay, sessions);
  // AND the recordings cover replies, tool calls, usage and ended turns
  await expectRecordingsToCoverTheSupportedKinds(relay, sessions);
});
