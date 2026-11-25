import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { expectStreamToBeAtTheEnd } from "../support/browser/stable-stream-expectations.ts";
import {
  aSessionWritingALongAnswerOpenInTheBrowser,
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
  "scrolling back down to the end makes the view follow the agent again",
  async () => {
    // ********************************************************************
    // ** GIVEN a user who scrolled up while the agent wrote ten more paragraphs
    // ********************************************************************
    const app = await startAppInBrowser();
    const { secondHold } = await aUserWhoScrolledUpWhileTheAgentWroteMore(app);

    // ********************************************************************
    // ** WHEN the user scrolls down to the end and the agent writes its last paragraph
    // ********************************************************************
    await app.page.scrollsTheStreamToTheEnd();
    await secondHold.letsTheAgentGoOn();
    await expectStreamToShow(app, paragraph(LONG_ANSWER.last));

    // ********************************************************************
    // ** THEN the view is at the end, showing the last paragraph
    // ********************************************************************
    await expectStreamToBeAtTheEnd(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a session opens at the end of its conversation and follows what the agent writes next",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that has written a long answer and is about to write more
    // ********************************************************************
    const app = await startAppInBrowser();

    // ********************************************************************
    // ** WHEN the user opens the session
    // ********************************************************************
    const { firstHold } = await aSessionWritingALongAnswerOpenInTheBrowser(app);

    // ********************************************************************
    // ** THEN the conversation is scrolled to its end
    // ********************************************************************
    await expectStreamToBeAtTheEnd(app);
    // AND it stays at the end as the agent writes ten more paragraphs
    await firstHold.letsTheAgentGoOn();
    await expectStreamToShow(app, paragraph(LONG_ANSWER.second));
    await expectStreamToBeAtTheEnd(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "letting go of a selection near the end makes the view follow the agent again",
  async () => {
    // ********************************************************************
    // ** GIVEN a user who selected the last paragraph of a long answer that is still being written
    // ********************************************************************
    const app = await startAppInBrowser();
    const { firstHold } = await aSessionWritingALongAnswerOpenInTheBrowser(app);
    await expectStreamToBeAtTheEnd(app);
    await app.page.selectsTextInTheStream(paragraph(LONG_ANSWER.first));

    // ********************************************************************
    // ** WHEN the user drops the selection and the agent writes ten more paragraphs
    // ********************************************************************
    await app.page.clearsTheSelection();
    await firstHold.letsTheAgentGoOn();
    await expectStreamToShow(app, paragraph(LONG_ANSWER.second));

    // ********************************************************************
    // ** THEN the view is at the end, showing them
    // ********************************************************************
    await expectStreamToBeAtTheEnd(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
