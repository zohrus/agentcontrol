import { afterEach, test } from "bun:test";
import {
  expectStreamToShow,
  expectUsageChipToShow,
} from "../support/browser/browser-expectations.ts";
import { aSessionWithAQueuedFirstPrompt } from "../support/browser/queued-prompt-setups.ts";
import {
  expectBlockToBeClosed,
  expectEndOfTurnLineInPlaceOfWorkingRow,
  expectHeaderToKeepItsHeight,
  expectItemKeptItsElementPlaceAndSize,
  expectLastRowToSay,
  theMarkedItem,
} from "../support/browser/stable-stream-expectations.ts";
import { theAgentWaitsForTheTest } from "../support/browser/stable-stream-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillReplyReporting1200And340Tokens } from "../support/setup/reported-usage.ts";

afterEach(cleanUpAfterTest);

test(
  "while a turn runs the last row says it is working, and the end of the turn takes its place",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that writes a line and then keeps working, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReply("Starting");
    const hold = theAgentWaitsForTheTest(app);
    const session = await app.user.startsSession({ prompt: "Do the work" });
    await app.page.opensSession(session.title);
    await expectStreamToShow(app, "Starting");
    await expectLastRowToSay(app, "Working");
    const working = await app.page.lastItem();

    // ********************************************************************
    // ** WHEN the turn ends
    // ********************************************************************
    await hold.letsTheAgentGoOn();

    // ********************************************************************
    // ** THEN the end-of-turn line is the last row, where the working row was and as tall
    // ********************************************************************
    await expectEndOfTurnLineInPlaceOfWorkingRow(app, working ?? { text: "", top: 0, height: 0 });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the header stays one line of the same height when the turn ends and the usage appears",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in a browser 800 px wide, whose agent works and then reports usage
    // ********************************************************************
    const app = await startAppInBrowser({ viewport: { width: 800, height: 700 } });
    app.mockAgent.willReply("Starting");
    const hold = theAgentWaitsForTheTest(app);
    agentWillReplyReporting1200And340Tokens(app.mockAgent);
    const session = await app.user.startsSession({ prompt: "Do the work" });
    await app.page.opensSession(session.title);
    await expectLastRowToSay(app, "Working");
    const before = await app.page.sessionHeader();

    // ********************************************************************
    // ** WHEN the turn ends
    // ********************************************************************
    await hold.letsTheAgentGoOn();
    await expectLastRowToSay(app, "Turn ended");

    // ********************************************************************
    // ** THEN the usage is in the header, which is one line of the same height
    // ********************************************************************
    await expectUsageChipToShow(app, "1.5k tokens · $0.02");
    await expectHeaderToKeepItsHeight(app, before);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the setup block starts closed, names the step that runs, and keeps its place and height when setup finishes",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose setup is still running and whose first message waits for it
    // ********************************************************************
    const app = await startAppInBrowser();
    app.mockAgent.willReply("Rate limiting is in place");
    const setup = await aSessionWithAQueuedFirstPrompt(app, "Add rate limiting");
    await expectStreamToShow(app, "Setting up the worktree… · ");
    await app.page.marksTheItemWith("Setting up the worktree…", "setup");
    const before = await theMarkedItem(app, "setup");
    // AND the block is closed, with the step that runs in its one line
    await expectBlockToBeClosed(app, "setup");

    // ********************************************************************
    // ** WHEN the setup finishes and the agent replies
    // ********************************************************************
    await setup.finishes();
    await expectStreamToShow(app, "Rate limiting is in place");

    // ********************************************************************
    // ** THEN the block is the same element, closed, in the same place and as tall
    // ********************************************************************
    await expectItemKeptItsElementPlaceAndSize(app, {
      mark: "setup",
      what: "the setup block",
      before,
    });
    await expectBlockToBeClosed(app, "setup");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a setup that fails is flagged in the closed setup block, which the user opens to see why",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose setup is still running
    // ********************************************************************
    const app = await startAppInBrowser();
    const setup = await aSessionWithAQueuedFirstPrompt(app, "Add rate limiting");
    await expectStreamToShow(app, "Setting up the worktree…");
    await app.page.marksTheItemWith("Setting up the worktree…", "setup");
    const before = await theMarkedItem(app, "setup");

    // ********************************************************************
    // ** WHEN the setup fails
    // ********************************************************************
    await setup.breaks();

    // ********************************************************************
    // ** THEN the one line of the block says it failed, and the block is closed and as tall
    // ********************************************************************
    await expectStreamToShow(app, "Worktree setup failed (exit 3)");
    await expectBlockToBeClosed(app, "setup");
    await expectItemKeptItsElementPlaceAndSize(app, {
      mark: "setup",
      what: "the setup block",
      before,
    });
    // AND opening it shows why
    await app.page.opensTheSetupOutput();
    await expectStreamToShow(app, "setup broke");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
