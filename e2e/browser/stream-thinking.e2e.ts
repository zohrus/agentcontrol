import { afterEach, test } from "bun:test";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import {
  expectThinkingBoxToBeAtMostLines,
  expectThinkingBoxToBeMoreThanLines,
  expectThoughtBoxFollowedItsEnd,
  expectThoughtBoxStayedWithinLines,
} from "../support/browser/stream-thinking-expectations.ts";
import {
  aReadySessionWhoseStreamIsRecorded,
  theUserAsksAndTheTurnEnds,
} from "../support/browser/stream-setups.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

const LONG_THOUGHT = Array.from(
  { length: 40 },
  (_, at) => `Considering option ${String(at + 1)}.`,
).join("\n");

async function aSessionThatThinksAtLength() {
  const app = await startAppInBrowser();
  app.mockAgent.willStreamThoughtInChunks(LONG_THOUGHT, { size: 25 });
  app.mockAgent.willReply("Done thinking");
  const { stream } = await aReadySessionWhoseStreamIsRecorded(app);
  return { app, stream };
}

test(
  "a long thought stays open in a box of about six lines that follows its newest line",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that thinks for forty lines before it replies
    // ********************************************************************
    const { app, stream } = await aSessionThatThinksAtLength();

    // ********************************************************************
    // ** WHEN the user asks and the turn ends
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Think hard");

    // ********************************************************************
    // ** THEN the thinking box never grew past six lines, and showed its last line while it streamed
    // ********************************************************************
    const recording = await stream.recording();
    expectThoughtBoxStayedWithinLines({ recording, lines: 6 });
    expectThoughtBoxFollowedItsEnd(recording);
    // AND the thinking is still open when the turn is over
    await expectStreamToShowAll(app, "Thinking", "Done thinking");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "after the turn the user can expand the thinking beyond six lines",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent thought for forty lines and whose turn has ended
    // ********************************************************************
    const { app, stream } = await aSessionThatThinksAtLength();
    await theUserAsksAndTheTurnEnds(app, "Think hard");
    // AND its thinking is shown in a box of six lines
    await expectThinkingBoxToBeAtMostLines({ stream, lines: 6 });

    // ********************************************************************
    // ** WHEN the user presses "Show more" under the thinking
    // ********************************************************************
    await stream.expandsTheThinking();

    // ********************************************************************
    // ** THEN the box is taller than six lines
    // ********************************************************************
    await expectThinkingBoxToBeMoreThanLines({ stream, lines: 6 });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
