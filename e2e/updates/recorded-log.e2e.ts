import { afterEach, test } from "bun:test";
import {
  eventsStreamedByRelay,
  expectPermissionRequestDescribed,
  expectReplyAsUpdate,
  expectTurnEndedAsUpdate,
  expectUsageFromUpdates,
} from "../support/expect/update-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { relayHoldsSessionRecordedBeforeNormalisation } from "../support/setup/recorded-session.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a session recorded before normalised updates existed is served with them", async () => {
  // ********************************************************************
  // ** GIVEN a relay holding a session log that has only raw ACP messages
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  const session = await relayHoldsSessionRecordedBeforeNormalisation(relay);

  // ********************************************************************
  // ** WHEN the app follows that session from the start
  // ********************************************************************
  await relay.followsSessionAfter(session, 0);

  // ********************************************************************
  // ** THEN the old reply arrives as an agent-text update
  // ********************************************************************
  const events = eventsStreamedByRelay(relay, session);
  await expectReplyAsUpdate(events, "Creating the file.");
  // AND the old turn arrives as a turn-ended update
  await expectTurnEndedAsUpdate(events, "end_turn");
  // AND the old permission request is described as a Write of hello.txt
  await expectPermissionRequestDescribed(events, { title: "Write hello.txt", kind: "edit" });
  // AND the old session's usage comes out of its updates
  const usage = { session, inputTokens: 8, costUsd: 0.11642330000000001, model: "claude-opus-5-5" };
  await expectUsageFromUpdates(relay, usage);
});
