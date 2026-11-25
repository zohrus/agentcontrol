import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import {
  expectStreamToBeAtTheEnd,
  expectViewStayedWhereTheUserScrolled,
} from "../support/browser/stable-stream-expectations.ts";
import { paragraph } from "../support/browser/stable-stream-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import {
  aSessionWhoseAnswerGrowsByOneLargeChunk,
  aSessionWhoseReaderScrolledUpBeforeALargeChunk,
  GROWING_ANSWER,
} from "../support/browser/stream-setups.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a reply revealed at a pace keeps the view at the end while it grows",
  async () => {
    // ********************************************************************
    // ** GIVEN a conversation at its end, whose agent is about to write thirty more paragraphs in one chunk
    // ********************************************************************
    const { app, hold } = await aSessionWhoseAnswerGrowsByOneLargeChunk();
    await expectStreamToBeAtTheEnd(app);

    // ********************************************************************
    // ** WHEN the agent writes them and the page reveals them
    // ********************************************************************
    await hold.letsTheAgentGoOn();
    await expectStreamToShow(app, paragraph(GROWING_ANSWER.last));

    // ********************************************************************
    // ** THEN the view is at the end, showing the last paragraph
    // ********************************************************************
    await expectStreamToBeAtTheEnd(app);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a reply revealed at a pace does not pull a reader who scrolled up back down",
  async () => {
    // ********************************************************************
    // ** GIVEN a reader who scrolled up, while the agent is about to write thirty more paragraphs in one chunk
    // ********************************************************************
    const { app, hold } = await aSessionWhoseReaderScrolledUpBeforeALargeChunk();
    const before = await app.page.streamView();

    // ********************************************************************
    // ** WHEN the agent writes them and the page reveals them
    // ********************************************************************
    await hold.letsTheAgentGoOn();
    await expectStreamToShow(app, paragraph(GROWING_ANSWER.last));

    // ********************************************************************
    // ** THEN the view is still where the reader left it
    // ********************************************************************
    await expectViewStayedWhereTheUserScrolled(app, before);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
