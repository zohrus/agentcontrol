import { afterEach, test } from "bun:test";
import { expectSessionWaitingForApproval } from "../support/expect/app-expectations.ts";
import {
  expectAnalyticsToCountOneTurn,
  expectAnalyticsToCountTurns,
  expectAnalyticsToShowSessionWaiting,
  expectTheLogToSayUsageCouldNotBeRead,
  expectWaitingNotToRunPastTheRange,
} from "../support/expect/analytics-live-expectations.ts";
import { expectSessionTable } from "../support/expect/analytics-insight-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillReplyReporting1200And340Tokens } from "../support/setup/reported-usage.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";
import {
  aRelayThatCannotReadUsage,
  theAppsErrorLog,
} from "../support/setup/usage-refusing-relay.ts";

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

test("a waiting session's time is not counted past the end of the range asked for", async () => {
  // ********************************************************************
  // ** GIVEN a session that is still waiting for approval to run `npm test`
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  app.mockAgent.willAskToRunCommand("npm test");
  const session = await app.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(app, session);

  // ********************************************************************
  // ** WHEN the user reads the analytics for a range that ended just after the request was asked
  // ********************************************************************
  // (read by the check below)

  // ********************************************************************
  // ** THEN the session waited no longer than that range lasted, not until now
  // ********************************************************************
  await expectWaitingNotToRunPastTheRange(app, "Run the tests");
});

test("when the relay cannot read the usage of a session, the app says so in its log", async () => {
  // ********************************************************************
  // ** GIVEN a relay that answers every request for usage with an error
  // ********************************************************************
  const log = theAppsErrorLog();
  const app = await startAppWithLocalWorkspace({ relayWire: aRelayThatCannotReadUsage });
  agentWillReplyReporting1200And340Tokens(app.mockAgent);

  // ********************************************************************
  // ** WHEN a session finishes a turn, so the app asks the relay for its usage
  // ********************************************************************
  await app.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the app's log says the usage could not be read, and why
  // ********************************************************************
  await expectTheLogToSayUsageCouldNotBeRead(log);
});

test("a second turn is counted even though the first was already read", async () => {
  // ********************************************************************
  // ** GIVEN a session whose first turn the analytics already counted
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  agentWillReplyReporting1200And340Tokens(app.mockAgent);
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectAnalyticsToCountTurns(app, 1);

  // ********************************************************************
  // ** WHEN the user sends a second message and the agent finishes it
  // ********************************************************************
  await app.user.sendsMessage(session, "Now add a test");

  // ********************************************************************
  // ** THEN the analytics count two turns
  // ********************************************************************
  await expectAnalyticsToCountTurns(app, 2);
});
