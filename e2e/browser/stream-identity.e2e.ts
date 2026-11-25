import { afterEach, test } from "bun:test";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import {
  expectFewerPageUpdatesThanChunks,
  expectTheFirstParagraphWasNeverReplaced,
} from "../support/browser/stream-expectations.ts";
import {
  aSessionStreamingAReplyInChunks,
  theUserAsksAndTheTurnEnds,
} from "../support/browser/stream-setups.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the first paragraph of a long reply is the same element after two hundred more chunks",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a long reply in chunks of five characters
    // ********************************************************************
    const reply = `First paragraph stays put.\n\n${"word ".repeat(300)}`;
    const { app, stream } = await aSessionStreamingAReplyInChunks({ reply, size: 5 });

    // ********************************************************************
    // ** WHEN the user asks and the turn ends
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Write a lot");

    // ********************************************************************
    // ** THEN the first paragraph is still the element drawn first, and nothing shown was redrawn
    // ********************************************************************
    await expectTheFirstParagraphWasNeverReplaced(stream);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a hundred small chunks are fewer updates of the page",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a reply in a hundred small chunks, a few milliseconds apart
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({
      reply: "word ".repeat(100),
      size: 5,
    });

    // ********************************************************************
    // ** WHEN the user asks and the turn ends
    // ********************************************************************
    await theUserAsksAndTheTurnEnds(app, "Write some");

    // ********************************************************************
    // ** THEN the page changed fewer times than there were chunks
    // ********************************************************************
    expectFewerPageUpdatesThanChunks({ recording: await stream.recording(), chunks: 100 });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
