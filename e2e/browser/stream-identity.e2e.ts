import { afterEach, expect, test } from "bun:test";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import {
  expectNothingAlreadyShownWasRedrawn,
  expectShownTextNeverGotShorter,
} from "../support/browser/stream-expectations.ts";
import {
  aSessionStreamingAReplyInChunks,
  theUserAsksAndTheTurnEnds,
} from "../support/browser/stream-setups.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

const FIRST = "First paragraph stays put.";
const REPLY = `${FIRST}\n\n${"word ".repeat(300)}`;

test(
  "the first paragraph of a long reply is the same element after two hundred more chunks",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a long reply in chunks of five characters
    // ********************************************************************
    const { app, stream } = await aSessionStreamingAReplyInChunks({ reply: REPLY, size: 5 });

    // ********************************************************************
    // ** WHEN the user asks, and the first paragraph has been shown
    // ********************************************************************
    await app.page.sendsMessage("Write a lot");
    await expectStreamToShowAll(app, FIRST);
    await stream.remembersBlock({ message: 0, block: 0 });
    // AND the rest of the reply streams in
    await expectStreamToShowAll(app, "Turn ended");

    // ********************************************************************
    // ** THEN that paragraph is still the same element, and nothing shown was redrawn
    // ********************************************************************
    expect(await stream.rememberedBlockIsStillShown({ message: 0, block: 0 })).toBe(true);
    const recording = await stream.recording();
    expectNothingAlreadyShownWasRedrawn(recording);
    expectShownTextNeverGotShorter(recording);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "every chunk of a reply is not a separate update of the page",
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
    const { commits } = await stream.recording();
    expect(commits).toBeLessThan(100);
  },
  BROWSER_TEST_TIMEOUT_MS,
);
