import { afterEach, test } from "bun:test";
import {
  expectAnalyticsToShow,
  expectHeadlineToShow,
  expectInsightToSay,
  expectSessionToBeOpenInstead,
  expectTableOrder,
  expectTodayCostToShow,
  startSeededAppInBrowser,
} from "../support/browser/analytics-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { TWO_SESSIONS_TWO_MODELS } from "../support/setup/analytics-scenarios.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { SESSION_THAT_WAITED_TEN_MINUTES } from "../support/setup/insight-scenarios.ts";
import { agentWillReplyCostingFourTenthsOfACent } from "../support/setup/sub-cent-usage.ts";

afterEach(cleanUpAfterTest);

test(
  "the Analytics screen says there is nothing to show before any session exists",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser and no session has been started
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the user presses Analytics
    // ********************************************************************
    await app.page.opensAnalytics();

    // ********************************************************************
    // ** THEN the screen says there are no sessions yet
    // ********************************************************************
    await expectAnalyticsToShow(app, "No sessions yet.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the Analytics screen shows the headline numbers of two sessions",
  async () => {
    // ********************************************************************
    // ** GIVEN two finished sessions that used 4,900 tokens and cost $0.06 together
    // ********************************************************************
    const app = await startSeededAppInBrowser(TWO_SESSIONS_TWO_MODELS);

    // ********************************************************************
    // ** WHEN the user presses Analytics
    // ********************************************************************
    await app.page.opensAnalytics();

    // ********************************************************************
    // ** THEN the headline shows 2 sessions, 4.9k tokens and a cost of $0.06
    // ********************************************************************
    await expectHeadlineToShow(app, { label: "Sessions", value: "2" });
    await expectHeadlineToShow(app, { label: "Tokens", value: "4.9k" });
    await expectHeadlineToShow(app, { label: "Cost", value: "$0.06" });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "pressing a column heading sorts the session table",
  async () => {
    // ********************************************************************
    // ** GIVEN two sessions of 4,300 and 600 tokens, with the Analytics screen open
    // ********************************************************************
    const app = await startSeededAppInBrowser(TWO_SESSIONS_TWO_MODELS);
    await app.page.opensAnalytics();
    await expectTableOrder(app, ["Fix login bug", "Add rate limiting"]);

    // ********************************************************************
    // ** WHEN the user presses the Tokens heading
    // ********************************************************************
    await app.page.sortsTheTableBy("Tokens");

    // ********************************************************************
    // ** THEN the session with the most tokens comes first
    // ********************************************************************
    await expectTableOrder(app, ["Add rate limiting", "Fix login bug"]);
    // AND pressing it again puts the smaller one first
    await app.page.sortsTheTableBy("Tokens");
    await expectTableOrder(app, ["Fix login bug", "Add rate limiting"]);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "pressing a session in the table opens it",
  async () => {
    // ********************************************************************
    // ** GIVEN two sessions and the Analytics screen open
    // ********************************************************************
    const app = await startSeededAppInBrowser(TWO_SESSIONS_TWO_MODELS);
    await app.page.opensAnalytics();
    await expectTableOrder(app, ["Fix login bug", "Add rate limiting"]);

    // ********************************************************************
    // ** WHEN the user presses "Add rate limiting" in the table
    // ********************************************************************
    await app.page.opensSessionFromTheTable("Add rate limiting");

    // ********************************************************************
    // ** THEN that session is open and the Analytics screen is gone
    // ********************************************************************
    await expectSessionToBeOpenInstead(app, "Add rate limiting");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "an insight links to the session behind it",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose request waited ten minutes, with the Analytics screen open
    // ********************************************************************
    const app = await startSeededAppInBrowser(SESSION_THAT_WAITED_TEN_MINUTES);
    await app.page.opensAnalytics();
    await expectInsightToSay(app, { rule: "long-waits", text: "waited 5m or more" });

    // ********************************************************************
    // ** WHEN the user presses the session's name under the insight
    // ********************************************************************
    await app.page.opensSessionFromInsight({ rule: "long-waits", title: "Deploy the preview" });

    // ********************************************************************
    // ** THEN that session is open
    // ********************************************************************
    await expectSessionToBeOpenInstead(app, "Deploy the preview");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a cost under one cent shows as less than a cent in the status bar, not as $0.00",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that will reply and report a cost of $0.004
    // ********************************************************************
    const app = await startAppInBrowser();
    agentWillReplyCostingFourTenthsOfACent(app.mockAgent);

    // ********************************************************************
    // ** WHEN the user starts a session and its turn finishes
    // ********************************************************************
    const session = await app.user.startsSession({ prompt: "Add rate limiting" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the status bar shows "<$0.01 today"
    // ********************************************************************
    await expectTodayCostToShow(app, "<$0.01 today");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
