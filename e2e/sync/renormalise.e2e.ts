import { afterEach, test } from "bun:test";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import {
  expectLiveStreamToDeliverTheReplyAgain,
  expectSavedHistoryToLackUpdates,
} from "../support/expect/renormalise-expectations.ts";
import {
  eventsReadThroughSdk,
  expectReplyAsUpdate,
} from "../support/expect/update-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { makeSavedEventsLookOlderThanTheRelay } from "../support/setup/stale-events.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("when the relay translates agent messages in a newer way, the app re-reads the sessions it saved the old way", async () => {
  // ********************************************************************
  // ** GIVEN a session whose reply the app saved before the relay's translation improved
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("All done");
  const session = await app.user.startsSession({ prompt: "Say when you are done" });
  await expectSessionWaitingForReply(app, session);
  await app.theRelayStops();
  makeSavedEventsLookOlderThanTheRelay(app);
  await expectSavedHistoryToLackUpdates(app, { session, reply: "All done" });

  // ********************************************************************
  // ** WHEN the relay starts again with a newer event translation
  // ********************************************************************
  await app.theRelayStartsAgain({ normaliserVersion: 2 });

  // ********************************************************************
  // ** THEN the saved history of the session holds the reply as an update again
  // ********************************************************************
  await expectReplyAsUpdate(eventsReadThroughSdk(app, session), "All done");
  // AND the live stream delivered that event again for the UI to update
  await expectLiveStreamToDeliverTheReplyAgain(app, { session, reply: "All done" });
});
