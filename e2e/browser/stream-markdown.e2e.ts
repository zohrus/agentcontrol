import { afterEach, test } from "bun:test";
import {
  expectMarkersWereNeverShown,
  expectNothingAlreadyShownWasRedrawn,
  expectNothingWasEverDrawnInBold,
  expectShownTextNeverGotShorter,
  expectTableAppearedOnlyOnceComplete,
  expectTableNeverHadMoreColumnsThan,
} from "../support/browser/stream-expectations.ts";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import {
  aSessionStreamingAReplyInChunks,
  theUserAsksAndTheTurnEnds,
} from "../support/browser/stream-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a line that turns out to be a list item is never shown as plain text first",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a numbered list one character at a time
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({
      reply: "Steps:\n\n1. first\n2. second\n3. third\n",
      size: 1,
    });

    // ********************************************************************
    // ** WHEN the user asks and the reply streams in
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "List the steps");

    // ********************************************************************
    // ** THEN no block already shown was redrawn as another kind of block
    // ********************************************************************
    const recording = await stream.recording();
    expectNothingAlreadyShownWasRedrawn(recording);
    // AND the number and its dot never showed on a line of their own
    expectMarkersWereNeverShown(recording, ["Steps:1", "first2", "second3"]);
    // AND the list reads in full at the end
    await expectStreamToShowAll(app, "first", "second", "third");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "bold text split across chunks never shows its asterisks",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a sentence with bold text and code, three characters at a time
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({
      reply: "Use **bold words** and `some code` here.",
      size: 3,
    });

    // ********************************************************************
    // ** WHEN the user asks and the reply streams in
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Say it with style");

    // ********************************************************************
    // ** THEN no marker was shown at any moment, and the shown text only grew
    // ********************************************************************
    const recording = await stream.recording();
    expectMarkersWereNeverShown(recording, ["*", "`"]);
    expectShownTextNeverGotShorter(recording);
    // AND the sentence reads in full at the end
    await expectStreamToShowAll(app, "Use bold words and some code here.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a heading split after its hashes is drawn as a heading from its first letter",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a heading and a paragraph, two characters at a time
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({
      reply: "## Rate limits\n\nThey are per key.",
      size: 2,
    });

    // ********************************************************************
    // ** WHEN the user asks and the reply streams in
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Explain");

    // ********************************************************************
    // ** THEN the hashes were never shown and no block was redrawn
    // ********************************************************************
    const recording = await stream.recording();
    expectMarkersWereNeverShown(recording, ["#"]);
    expectNothingAlreadyShownWasRedrawn(recording);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a code fence split across chunks is a code block from the start",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a paragraph, a code block and a paragraph, two characters at a time
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({
      reply: "Run:\n\n```ts\nconst a = 1;\nconst b = 2;\n```\n\nDone.",
      size: 2,
    });

    // ********************************************************************
    // ** WHEN the user asks and the reply streams in
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Show the code");

    // ********************************************************************
    // ** THEN the backticks were never shown and no block was redrawn
    // ********************************************************************
    const recording = await stream.recording();
    expectMarkersWereNeverShown(recording, ["`"]);
    expectNothingAlreadyShownWasRedrawn(recording);
    // AND the code reads in full at the end
    await expectStreamToShowAll(app, "const a = 1;", "const b = 2;", "Done.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a table is drawn as a table, and only once its header and delimiter rows have arrived",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a table with two rows, four characters at a time
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({
      reply: "Limits:\n\n| Plan | Limit |\n|---|---|\n| Free | 10 |\n| Pro | 100 |\n\nThat is all.",
      size: 4,
    });

    // ********************************************************************
    // ** WHEN the user asks and the reply streams in
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Show the limits");

    // ********************************************************************
    // ** THEN the table appeared without any raw row of pipes being shown first
    // ********************************************************************
    const recording = await stream.recording();
    expectTableAppearedOnlyOnceComplete(recording);
    expectNothingAlreadyShownWasRedrawn(recording);
    // AND the cells read in full at the end
    await expectStreamToShowAll(app, "Plan", "Limit", "Free", "100", "That is all.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a pipe in a table cell's code or after a backslash does not split the cell, and two asterisks around a space are not bold",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a sum and a two-column table with pipes in its cells
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({
      reply: "Compute 2 ** 3 now.\n\n| Command | Note |\n|---|---|\n| `a \\| b` | one \\| two |\n",
      size: 3,
    });

    // ********************************************************************
    // ** WHEN the user asks and the reply streams in
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Show the pipes");

    // ********************************************************************
    // ** THEN the table never had more than two columns, and nothing was drawn in bold
    // ********************************************************************
    const recording = await stream.recording();
    expectTableNeverHadMoreColumnsThan({ recording, columns: 2 });
    expectNothingWasEverDrawnInBold(recording);
    // AND the sum reads as written
    await expectStreamToShowAll(app, "Compute 2 ** 3 now.");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
