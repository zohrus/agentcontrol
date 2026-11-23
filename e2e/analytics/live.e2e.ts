import { afterEach, test } from "bun:test";
import { expectSessionWaitingForApproval } from "../support/expect/app-expectations.ts";
import {
  expectAnalyticsToCountOneTurn,
  expectAnalyticsToShowSessionWaiting,
} from "../support/expect/analytics-live-expectations.ts";
import { expectSessionTable } from "../support/expect/analytics-insight-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillReplyReporting1200And340Tokens } from "../support/setup/reported-usage.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a turn that just finished shows in the analytics and stays there while the workspace is offline", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will reply and report 1200 input and 340 output tokens
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  agentWillReplyReporting1200And340Tokens(app.mockAgent);
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectAnalyticsToCountOneTurn(app, { input: 1200, output: 340 });

  // ********************************************************************
  // ** WHEN the workspace goes offline
  // ********************************************************************
  await app.theRelayStops();

  // ********************************************************************
  // ** THEN the analytics still count that turn
  // ********************************************************************
  await expectAnalyticsToCountOneTurn(app, { input: 1200, output: 340 });
  // AND the session is still in the table under its own title
  await expectSessionTable(app, { titles: [session.title] });
});

test("restarting the app and reading the relay again does not count a turn twice", async () => {
  // ********************************************************************
  // ** GIVEN a finished turn of 1200 input and 340 output tokens that the analytics have counted
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  agentWillReplyReporting1200And340Tokens(app.mockAgent);
  await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectAnalyticsToCountOneTurn(app, { input: 1200, output: 340 });

  // ********************************************************************
  // ** WHEN the app restarts and syncs with the relay again
  // ********************************************************************
  await app.restartsTheApp();

  // ********************************************************************
  // ** THEN the analytics still count one turn of 1200 and 340 tokens
  // ********************************************************************
  await expectAnalyticsToCountOneTurn(app, { input: 1200, output: 340 });
});

test("a session still waiting for approval shows its waiting time growing", async () => {
  // ********************************************************************
  // ** GIVEN an agent that asks to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session and does not answer
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(app, session);

  // ********************************************************************
  // ** THEN the analytics count the unanswered request as waiting time
  // ********************************************************************
  await expectAnalyticsToShowSessionWaiting(app, "Run the tests");
});
