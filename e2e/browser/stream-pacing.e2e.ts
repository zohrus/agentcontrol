import { afterEach, test } from "bun:test";
import { expectStreamToShowAll } from "../support/browser/page-expectations.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import {
  expectReplyWasRevealedGradually,
  expectReplyWasShownWholeAtOnce,
  expectReplyWasWholeWhenTheCardAppeared,
  expectShownTextNeverGotShorter,
} from "../support/browser/stream-expectations.ts";
import { letsFramesRunUntilTheConversationShows } from "../support/browser/stream-frames.ts";
import {
  aSessionPartwayThroughALongReply,
  aSessionStreamingAReplyInChunks,
  theUserAsksAndTheTurnEnds,
} from "../support/browser/stream-setups.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

const WORDS = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu ".repeat(12);
const INTRO = "Intro. ";
const LONG_REPLY = `${INTRO}${"The rest of the answer goes on and on. ".repeat(160)}`;

/** An agent that streams the words in six chunks and keeps its turn open, in a session open in a browser. */
function aSessionStreamingSixChunks(reply: string) {
  const size = Math.ceil(reply.length / 6);
  return aSessionStreamingAReplyInChunks({ reply, size, holdsTheTurnOpen: true });
}

test(
  "a reply that arrives in large chunks is revealed in smaller steps, and is whole when the turn ends",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent that streams a reply in six chunks and keeps its turn open
    // ********************************************************************
    const reply = WORDS.trim();
    const { app, stream, endsTheTurn } = await aSessionStreamingSixChunks(reply);

    // ********************************************************************
    // ** WHEN the user asks and the page has caught up with the reply
    // ********************************************************************
    await app.page.sendsMessage("Say a lot");
    await expectStreamToShowAll(app, reply);

    // ********************************************************************
    // ** THEN the page showed the reply in more steps than it came in chunks
    // ********************************************************************
    const recording = await stream.recording();
    expectReplyWasRevealedGradually({ recording, chunks: 6 });
    // AND the shown text only ever grew
    expectShownTextNeverGotShorter(recording);
    // AND the turn can end
    await endsTheTurn();
    await expectStreamToShowAll(app, "Turn ended", reply);
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the reply shown so far is completed at once when a permission request arrives",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent partway through a long reply, in a page whose frames the test controls
    // ********************************************************************
    const { app, stream, agentGoesOn } = await aSessionPartwayThroughALongReply({
      intro: INTRO,
      rest: LONG_REPLY.slice(INTRO.length),
      then: (frozen) => {
        frozen.mockAgent.willAskToRunCommand("npm test");
      },
    });

    // ********************************************************************
    // ** WHEN the agent asks to run a command
    // ********************************************************************
    await agentGoesOn();
    await letsFramesRunUntilTheConversationShows({ app, stream, text: "npm test" });

    // ********************************************************************
    // ** THEN the reply above the request was shown in full when the request appeared
    // ********************************************************************
    expectReplyWasWholeWhenTheCardAppeared({
      recording: await stream.recording(),
      reply: LONG_REPLY,
    });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the reply shown so far is completed at once when the tab goes to the background",
  async () => {
    // ********************************************************************
    // ** GIVEN an agent partway through a long reply, in a page whose frames the test controls
    // ********************************************************************
    const { app, stream } = await aSessionPartwayThroughALongReply({
      intro: INTRO,
      rest: LONG_REPLY.slice(INTRO.length),
      then: () => undefined,
    });

    // ********************************************************************
    // ** WHEN the tab goes to the background
    // ********************************************************************
    await stream.goesToTheBackground();

    // ********************************************************************
    // ** THEN the whole reply is shown, without a frame having to run
    // ********************************************************************
    await expectStreamToShowAll(app, LONG_REPLY.trim());
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a session opened again after a reload shows the whole reply at once",
  async () => {
    // ********************************************************************
    // ** GIVEN a session whose agent streamed a reply in chunks and whose turn has ended
    // ********************************************************************
    const reply = WORDS.trim();
    const { app, stream } = await aSessionStreamingAReplyInChunks({ reply, size: 40 });
    await theUserAsksAndTheTurnEnds(app, "Say a lot");

    // ********************************************************************
    // ** WHEN the user reloads the page
    // ********************************************************************
    await app.page.reloads();

    // ********************************************************************
    // ** THEN the first thing the page showed of the reply was all of it
    // ********************************************************************
    await expectStreamToShowAll(app, reply);
    expectReplyWasShownWholeAtOnce({ recording: await stream.recording(), reply });
  },
  BROWSER_TEST_TIMEOUT_MS,
);
