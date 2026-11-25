import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import {
  expectConversationToKeepItsHeight,
  expectJumpToLatestOffered,
  expectNoJumpToLatest,
  expectStreamToBeAtTheEnd,
  expectViewStayedWhereTheUserScrolled,
} from "../support/browser/stable-stream-expectations.ts";
import {
  aSessionWritingALongAnswerOpenInTheBrowser,
  theAgentWritesTenMoreParagraphs,
  aUserWhoScrolledUpWhileTheAgentWroteMore,
  LONG_ANSWER,
  paragraph,
} from "../support/browser/stable-stream-setups.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "scrolling up while the agent is still writing keeps the view where the user left it",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that is writing a long answer, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    const { firstHold } = await aSessionWritingALongAnswerOpenInTheBrowser(app);

    // ********************************************************************
    // ** WHEN the user scrolls up and the agent writes ten more paragraphs
    // ********************************************************************
    await app.page.scrollsTheStreamUp(400);
    const before = await app.page.streamView();
    await theAgentWritesTenMoreParagraphs(app, firstHold);

    // ********************************************************************
    // ** THEN the view has not moved: same scroll position, same paragraph in the same place
    // ********************************************************************
    await expectViewStayedWhereTheUserScrolled(app, before);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "pressing Page Up while the agent is still writing keeps the view where the user left it",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that is writing a long answer, open in the browser
    // ********************************************************************
    const app = await startAppInBrowser();
    const { firstHold } = await aSessionWritingALongAnswerOpenInTheBrowser(app);

    // ********************************************************************
    // ** WHEN the user presses Page Up in the conversation and the agent writes ten more paragraphs
    // ********************************************************************
    await app.page.pressesKeyInTheStream("PageUp");
    const before = await app.page.streamView();
    await theAgentWritesTenMoreParagraphs(app, firstHold);

    // ********************************************************************
    // ** THEN the view has not moved
    // ********************************************************************
    await expectViewStayedWhereTheUserScrolled(app, before);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "selecting text near the end of the conversation keeps the view still while the agent writes on",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that is writing a long answer, open in the browser at its end
    // ********************************************************************
    const app = await startAppInBrowser();
    const { firstHold } = await aSessionWritingALongAnswerOpenInTheBrowser(app);
    await expectStreamToBeAtTheEnd(app);

    // ********************************************************************
    // ** WHEN the user selects the last paragraph and the agent writes ten more paragraphs
    // ********************************************************************
    await app.page.selectsTextInTheStream(paragraph(LONG_ANSWER.first));
    const before = await app.page.streamView();
    await theAgentWritesTenMoreParagraphs(app, firstHold);

    // ********************************************************************
    // ** THEN the view has not moved
    // ********************************************************************
    await expectViewStayedWhereTheUserScrolled(app, before);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a Jump to latest button lies over the conversation once new output arrives out of view",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that is writing a long answer, and a user who scrolled up
    // ********************************************************************
    const app = await startAppInBrowser();
    const { firstHold } = await aSessionWritingALongAnswerOpenInTheBrowser(app);
    await app.page.scrollsTheStreamUp(400);
    await expectNoJumpToLatest(app);
    const height = await app.page.streamBoxHeight();

    // ********************************************************************
    // ** WHEN the agent writes ten more paragraphs
    // ********************************************************************
    await theAgentWritesTenMoreParagraphs(app, firstHold);

    // ********************************************************************
    // ** THEN the conversation offers to jump to the latest output
    // ********************************************************************
    await expectJumpToLatestOffered(app);
    // AND the button takes no room from the conversation
    await expectConversationToKeepItsHeight(app, height);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "pressing Jump to latest goes to the end and the view follows the agent again",
  async () => {
    // ********************************************************************
    // ** GIVEN a user who scrolled up while the agent wrote ten more paragraphs
    // ********************************************************************
    const app = await startAppInBrowser();
    const { secondHold } = await aUserWhoScrolledUpWhileTheAgentWroteMore(app);

    // ********************************************************************
    // ** WHEN the user presses Jump to latest and the agent writes its last paragraph
    // ********************************************************************
    await app.page.pressesJumpToLatest();
    await expectStreamToBeAtTheEnd(app);
    await secondHold.letsTheAgentGoOn();
    await expectStreamToShow(app, paragraph(LONG_ANSWER.last));

    // ********************************************************************
    // ** THEN the view is at the end, showing the last paragraph, and the button is gone
    // ********************************************************************
    await expectStreamToBeAtTheEnd(app);
    await expectNoJumpToLatest(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
