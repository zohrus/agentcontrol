import { afterEach, test } from "bun:test";
import { connectsAClientThatNeverHangsUp } from "../support/setup/stuck-client.ts";
import {
  expectAppToHaveBeenToldTheAgentExited,
  expectClientToHaveBeenCutOff,
  expectHistoryToEndWithTheReplyAndTheExit,
} from "../support/expect/relay-stop-expectations.ts";
import {
  eventsStreamedByRelay,
  expectReplyAsUpdate,
} from "../support/expect/update-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a client that never hangs up does not keep the relay from stopping", async () => {
  // ********************************************************************
  // ** GIVEN a relay with a client that does not hang up when the relay ends the connection
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();
  const client = await connectsAClientThatNeverHangsUp(relay);

  // ********************************************************************
  // ** WHEN the relay is stopped
  // ********************************************************************
  await relay.stopsTheRelayWhileTheAppIsConnected();

  // ********************************************************************
  // ** THEN the relay has cut that client off
  // ********************************************************************
  await expectClientToHaveBeenCutOff(client);
});

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
