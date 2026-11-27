import { afterEach, test } from "bun:test";
import {
  expectClipboardToHold,
  expectDetailsButtonToHaveTheFocus,
  expectDetailsButtonToSayItIsExpanded,
  expectNoArchiveButtonUnderTheMessageBox,
  expectDetailsToBeClosed,
  expectDetailsToBeOpen,
  expectDetailsToShow,
} from "../support/browser/header-expectations.ts";
import { opensSessionWithUncommittedEdit } from "../support/browser/open-session-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { agentWillReplyReporting1200And340Tokens } from "../support/setup/reported-usage.ts";

afterEach(cleanUpAfterTest);

async function aFinishedSessionWithUsageOpenInTheBrowser(options = {}) {
  const app = await startAppInBrowser(options);
  agentWillReplyReporting1200And340Tokens(app.mockAgent);
  const session = await app.user.startsSession({ prompt: "Check the readme" });
  await app.page.opensSession(session.title);
  return { app, session };
}

test(
  "the Details panel lists the status, agent, repository, branch, base branch and usage",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in a browser whose agent replied and reported its usage
    // ********************************************************************
    const { app } = await aFinishedSessionWithUsageOpenInTheBrowser();

    // ********************************************************************
    // ** WHEN the user presses the ⓘ button in the header
    // ********************************************************************
    await app.page.opensTheDetails();

    // ********************************************************************
    // ** THEN the panel lists the status and start time, the agent and its model, the repository
    // ** and the branch with its base, and the tokens with their cost
    // ********************************************************************
    await expectDetailsToShow(app, "waiting, started", "ago", "Mock agent · claude-sonnet-4-5");
    await expectDetailsToShow(app, app.repoPath, "from main");
    await expectDetailsToShow(app, "1.5k tokens · $0.02");
    await expectDetailsToShow(app, "1.2k in · 340 out · 800 cache read · 50 cache write");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Escape closes the Details panel and the focus goes back to the ⓘ button",
  async () => {
    // ********************************************************************
    // ** GIVEN the Details panel open
    // ********************************************************************
    const { app } = await aFinishedSessionWithUsageOpenInTheBrowser();
    await app.page.opensTheDetails();

    // ********************************************************************
    // ** WHEN the user presses Escape
    // ********************************************************************
    await app.page.closesTheDetailsWithEscape();

    // ********************************************************************
    // ** THEN the panel is closed and the ⓘ button has the focus
    // ********************************************************************
    await expectDetailsToBeClosed(app);
    await expectDetailsButtonToHaveTheFocus(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a click outside closes the Details panel",
  async () => {
    // ********************************************************************
    // ** GIVEN the Details panel open
    // ********************************************************************
    const { app } = await aFinishedSessionWithUsageOpenInTheBrowser();
    await app.page.opensTheDetails();

    // ********************************************************************
    // ** WHEN the user clicks on the conversation
    // ********************************************************************
    await app.page.clicksOutsideTheDetails();

    // ********************************************************************
    // ** THEN the panel is closed
    // ********************************************************************
    await expectDetailsToBeClosed(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the Details panel opens from the keyboard, and the button says whether it is open",
  async () => {
    // ********************************************************************
    // ** GIVEN a session open in a browser
    // ********************************************************************
    const { app } = await aFinishedSessionWithUsageOpenInTheBrowser();
    await expectDetailsButtonToSayItIsExpanded(app, false);

    // ********************************************************************
    // ** WHEN the user puts the focus on the ⓘ button and presses Enter
    // ********************************************************************
    await app.page.opensTheDetailsWithTheKeyboard();

    // ********************************************************************
    // ** THEN the panel is open and the button says it is expanded
    // ********************************************************************
    await expectDetailsToBeOpen(app);
    await expectDetailsButtonToSayItIsExpanded(app, true);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Copy branch name puts the branch on the clipboard",
  async () => {
    // ********************************************************************
    // ** GIVEN the Details panel open for a session in a browser that may use the clipboard
    // ********************************************************************
    const { app, session } = await aFinishedSessionWithUsageOpenInTheBrowser({ clipboard: true });
    await app.page.opensTheDetails();
    const { branch } = await app.sdk.sessions.get(session.id);

    // ********************************************************************
    // ** WHEN the user presses Copy branch name
    // ********************************************************************
    await app.page.copiesTheBranchName();

    // ********************************************************************
    // ** THEN the clipboard holds the branch name, and the panel says it was copied
    // ********************************************************************
    await expectClipboardToHold(app, branch);
    await expectDetailsToShow(app, "Copied");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "Archive is in the Details panel and no longer under the message box",
  async () => {
    // ********************************************************************
    // ** GIVEN a session with an uncommitted edit, open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();
    await opensSessionWithUncommittedEdit(app, "Reword the readme");

    // ********************************************************************
    // ** WHEN the user opens the Details panel
    // ********************************************************************
    await app.page.opensTheDetails();

    // ********************************************************************
    // ** THEN it offers Archive, and the message box has no Archive button
    // ********************************************************************
    await expectDetailsToShow(app, "Archive session…");
    await expectNoArchiveButtonUnderTheMessageBox(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
