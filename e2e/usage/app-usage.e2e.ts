import { afterEach, test } from "bun:test";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import { expectAppToReportTokensOfOneTurn } from "../support/expect/app-usage-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillReplyReporting1200And340Tokens } from "../support/setup/reported-usage.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("the app reports the tokens and cost of a finished turn through the SDK", async () => {
  // ********************************************************************
  // ** GIVEN an agent that will reply and report 1200 input and 340 output tokens costing $0.02
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  agentWillReplyReporting1200And340Tokens(app.mockAgent);

  // ********************************************************************
  // ** WHEN the user starts a session and its turn finishes
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** THEN the app reports one row with those tokens
  // ********************************************************************
  await expectAppToReportTokensOfOneTurn(app, { session, input: 1200, output: 340 });
});
