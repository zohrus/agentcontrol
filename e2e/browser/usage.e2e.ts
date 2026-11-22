import { afterEach, test } from "bun:test";
import { expectUsageChipToShow } from "../support/browser/browser-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillReplyReporting1200And340Tokens } from "../support/setup/reported-usage.ts";

afterEach(cleanUpAfterTest);

test(
  "the open session's header shows its tokens and cost once a turn has finished",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that will reply and report 1200 input and 340 output tokens costing $0.02
    // ********************************************************************
    const app = await startAppInBrowser();
    agentWillReplyReporting1200And340Tokens(app.mockAgent);

    // ********************************************************************
    // ** WHEN the user starts a session and opens it in the browser
    // ********************************************************************
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the header's usage chip shows 1.5k tokens and $0.02
    // ********************************************************************
    await expectUsageChipToShow(app, "1.5k tokens · $0.02");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
