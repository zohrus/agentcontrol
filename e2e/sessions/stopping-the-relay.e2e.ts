import { afterEach, test } from "bun:test";
import {
  expectAppToHaveBeenToldTheAgentExited,
  expectHistoryToEndWithTheReplyAndTheExit,
} from "../support/expect/relay-stop-expectations.ts";
import {
  eventsStreamedByRelay,
  expectReplyAsUpdate,
} from "../support/expect/update-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("stopping the relay during a turn tells the connected app the agent exited and keeps the reply", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent replied and is still working on its turn
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willReply("Running the tests now");
  relay.mockAgent.willWaitUntilCancelled();
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectReplyAsUpdate(eventsStreamedByRelay(relay, session), "Running the tests now");

  // ********************************************************************
  // ** WHEN the relay is stopped while the app is connected
  // ********************************************************************
  await relay.stopsTheRelayWhileTheAppIsConnected();

  // ********************************************************************
  // ** THEN the app was told, before its connection ended, that the agent exited
  // ********************************************************************
  await expectAppToHaveBeenToldTheAgentExited(relay, session);
  // AND after the relay starts again its history holds the reply and the exit
  await relay.startsTheRelayAndConnectsTheApp();
  await relay.followsSessionAfter(session, 0);
  await expectHistoryToEndWithTheReplyAndTheExit(relay, {
    session,
    reply: "Running the tests now",
  });
});
