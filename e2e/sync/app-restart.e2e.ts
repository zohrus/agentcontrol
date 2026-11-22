import { afterEach, test } from "bun:test";
import {
  expectHistoryContinuesWithoutGaps,
  expectLiveStreamDeliveredAgentReply,
  expectSessionWaitingForReply,
} from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("after the app restarts the history is kept and new events continue without gaps or repeats", async () => {
  // ********************************************************************
  // ** GIVEN a session whose agent answered the first message
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willReply("First answer");
  // AND the agent will answer the next message with "Second answer"
  app.mockAgent.onNextPrompt();
  app.mockAgent.willReply("Second answer");
  const session = await app.user.startsSession({ prompt: "Say hello" });
  await expectSessionWaitingForReply(app, session);
  const historyBefore = await app.user.readsHistoryOf(session);

  // ********************************************************************
  // ** WHEN the app is restarted and the user sends another message
  // ********************************************************************
  await app.restartsTheApp();
  await app.user.sendsMessage(session, "Thanks, and again?");

  // ********************************************************************
  // ** THEN the earlier history is unchanged and the new events follow it with no gap or repeat
  // ********************************************************************
  await expectHistoryContinuesWithoutGaps(app, { session, after: historyBefore });
  // AND the live stream of the restarted app delivered the second answer
  await expectLiveStreamDeliveredAgentReply(app, { session, text: "Second answer" });
});
