import { afterEach, test } from "bun:test";
import {
  expectChangedFilesToShow,
  expectChangesTabToBeOpen,
  expectCostToShow,
  expectCostTooltipToSay,
  expectHeaderStatusToBe,
  expectHeaderToShow,
  expectHeaderToShowNoneOf,
  expectNoCost,
  expectTitleOnOneLine,
  expectTitleToWrapWithoutBeingCut,
} from "../support/browser/header-expectations.ts";
import {
  opensSessionWithUncommittedEdit,
  startsSessionThatOnlyReplied,
} from "../support/browser/open-session-setups.ts";
import { theAgentWaitsForTheTest } from "../support/browser/stable-stream-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillReplyReporting1200And340Tokens } from "../support/setup/reported-usage.ts";

afterEach(cleanUpAfterTest);

const LONG_TITLE = "Add per-token rate limiting to the public API with a Retry-After header";

test(
  "the header shows the title and the status, and none of the details that moved to the Details panel",
  async () => {
    // ********************************************************************
    // ** GIVEN a session that is waiting for the user's reply
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await startsSessionThatOnlyReplied(app, "Check the readme");

    // ********************************************************************
    // ** WHEN the user opens it in a browser
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the header shows the title on one line and a status indicator
    // ********************************************************************
    await expectHeaderToShow(app, session.title);
    await expectTitleOnOneLine(app);
    await expectHeaderStatusToBe(app, "waiting");
    // AND it shows neither the agent, the repository, the base branch nor the time
    await expectHeaderToShowNoneOf(app, "Mock agent", app.repoPath, "from ", "ago");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a long title wraps onto more lines in a narrow window and is not cut",
  async () => {
    // ********************************************************************
    // ** GIVEN a browser window 1100 px wide, which leaves the session little room
    // ********************************************************************
    const app = await startAppInBrowser({ viewport: { width: 1100, height: 700 } });
    app.mockAgent.willReply("On it");
    const session = await app.user.startsSession({ prompt: LONG_TITLE });

    // ********************************************************************
    // ** WHEN the user opens a session with a long title
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the header shows all of the title, on several lines, with no ellipsis or clip
    // ********************************************************************
    await expectHeaderToShow(app, LONG_TITLE);
    await expectTitleToWrapWithoutBeingCut(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the files button shows how much the session changed and opens the Changes tab",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent edited README.md, open with the Editor tab showing
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionWithUncommittedEdit(app, "Reword the readme");
    await expectChangedFilesToShow(app, "1 file +1 −1");
    await app.page.opensEditorTab();

    // ********************************************************************
    // ** WHEN the user presses the files button in the header
    // ********************************************************************
    await app.page.pressesTheChangedFilesButton();

    // ********************************************************************
    // ** THEN the right-hand panel shows its Changes tab
    // ********************************************************************
    await expectChangesTabToBeOpen(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the header has no files button while the session has changed nothing",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent only replied
    // ********************************************************************
    const app = await startAppInBrowser();
    const session = await startsSessionThatOnlyReplied(app, "Check the readme");

    // ********************************************************************
    // ** WHEN the user opens it
    // ********************************************************************
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the header does not offer to show changes
    // ********************************************************************
    await expectHeaderToShow(app, session.title);
    await expectHeaderToShowNoneOf(app, "file");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the cost shows in the header once the agent reports usage, and not before",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent works and then reports usage costing $0.02
    // ********************************************************************
    const app = await startAppInBrowser();
    const hold = theAgentWaitsForTheTest(app);
    agentWillReplyReporting1200And340Tokens(app.mockAgent);
    const session = await app.user.startsSession({ prompt: "Do the work" });
    await app.page.opensSession(session.title);
    // AND the header shows no cost while the agent works
    await expectHeaderToShow(app, session.title);
    await expectNoCost(app);

    // ********************************************************************
    // ** WHEN the turn ends
    // ********************************************************************
    await hold.letsTheAgentGoOn();

    // ********************************************************************
    // ** THEN the header shows $0.02, and its tooltip gives the tokens
    // ********************************************************************
    await expectCostToShow(app, "$0.02");
    await expectCostTooltipToSay(app, "1.2k in · 340 out · 800 cache read · 50 cache write");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
