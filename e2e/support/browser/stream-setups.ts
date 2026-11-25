import { join } from "node:path";
import { expectStreamToShow } from "./browser-expectations.ts";
import { expectJumpToLatestOffered } from "./stable-stream-expectations.ts";
import { type Hold, paragraph, theAgentWaitsForTheTest } from "./stable-stream-setups.ts";
import { expectStreamToShowAll } from "./page-expectations.ts";
import { aReadySessionOpenInTheBrowser } from "./ready-session-setups.ts";
import { type AppInBrowser, startAppInBrowser } from "./start-app-in-browser.ts";
import {
  letsFramesRunUntilTheConversationShows,
  letsFramesRunUntilTheReplyShowsMoreThan,
} from "./stream-frames.ts";
import { streamRecorder } from "./stream-recorder.ts";

/** A session ready for its first message, open in a browser that records how the conversation changes. */
export async function aReadySessionWhoseStreamIsRecorded(app: AppInBrowser) {
  const session = await aReadySessionOpenInTheBrowser(app);
  const stream = streamRecorder(app.page.raw);
  await stream.startsRecording();
  return { session, stream };
}

async function aSessionWithARunningClock(configure: (app: AppInBrowser) => void) {
  const app = await startAppInBrowser();
  configure(app);
  const { session, stream } = await aReadySessionWhoseStreamIsRecorded(app);
  return { app, session, stream };
}

/**
 * An agent that streams this reply in chunks, in a session open in a browser that records the
 * stream. With `controlsTheFrames` the page's clock stands still and moves on only when the test
 * lets frames run, so how many steps the page takes does not depend on how busy the machine is.
 */
export async function aSessionStreamingAReplyInChunks(call: {
  reply: string;
  size: number;
  /** The turn stays open after the reply until the test calls `endsTheTurn`. */
  holdsTheTurnOpen?: boolean;
  controlsTheFrames?: boolean;
}) {
  const gate = { file: "" };
  const configure = (app: AppInBrowser): void => {
    gate.file = join(app.mockAgent.dataFolder, "end-of-turn");
    app.mockAgent.willStreamReplyInChunks(call.reply, { size: call.size });
    if (call.holdsTheTurnOpen === true) app.mockAgent.willWaitForFile(gate.file);
  };
  const started =
    call.controlsTheFrames === true
      ? await aSessionWithAFrozenClock(configure)
      : await aSessionWithARunningClock(configure);
  const endsTheTurn = async (): Promise<void> => {
    await Bun.write(gate.file, "");
  };
  return { ...started, endsTheTurn };
}

/** A session open in a browser whose clock stands still: the page moves on only when the test lets frames run. */
async function aSessionWithAFrozenClock(configure: (app: AppInBrowser) => void) {
  const app = await startAppInBrowser({ controllableClock: true });
  configure(app);
  const { session, stream } = await aReadySessionWhoseStreamIsRecorded(app);
  await stream.stopsTheClock();
  return { app, session, stream };
}

/** Sends the message and waits until the agent's turn has ended. */
export async function theUserAsksAndTheTurnEnds(app: AppInBrowser, prompt: string): Promise<void> {
  await app.page.sendsMessage(prompt);
  await expectStreamToShowAll(app, "Turn ended");
}

/**
 * A page whose clock stands still, in which an agent said its intro and is revealing the rest of a
 * long reply. What the agent does `then` waits until the test calls `agentGoesOn`.
 */
export async function aSessionPartwayThroughALongReply(call: {
  intro: string;
  rest: string;
  then: (app: AppInBrowser) => void;
}) {
  const gates = { more: "", next: "" };
  const { app, stream } = await aSessionWithAFrozenClock((frozen) => {
    gates.more = join(frozen.mockAgent.dataFolder, "more");
    gates.next = join(frozen.mockAgent.dataFolder, "next");
    frozen.mockAgent.willReply(call.intro);
    frozen.mockAgent.willWaitForFile(gates.more);
    frozen.mockAgent.willReply(call.rest);
    frozen.mockAgent.willWaitForFile(gates.next);
    call.then(frozen);
  });
  await app.page.sendsMessage("Explain at length");
  await letsFramesRunUntilTheConversationShows({ app, stream, text: call.intro.trim() });
  await Bun.write(gates.more, "");
  await letsFramesRunUntilTheReplyShowsMoreThan({ stream, length: call.intro.length });
  const agentGoesOn = async (): Promise<void> => {
    await Bun.write(gates.next, "");
  };
  return { app, stream, agentGoesOn };
}

/** The paragraph numbers of the answer the agent writes before its hold, and the last one it writes after. */
export const GROWING_ANSWER = { before: 40, last: 70 };

/**
 * A session open in the browser whose agent wrote 40 paragraphs, waits, and then writes 30 more
 * in one chunk: the chunk is revealed at a pace, below what is on the screen.
 */
export async function aSessionWhoseAnswerGrowsByOneLargeChunk() {
  const app = await startAppInBrowser();
  for (let at = 1; at <= GROWING_ANSWER.before; at++) {
    app.mockAgent.willReply(`${paragraph(at)}\n\n`);
  }
  const hold: Hold = theAgentWaitsForTheTest(app);
  const more = Array.from(
    { length: GROWING_ANSWER.last - GROWING_ANSWER.before },
    (_, at) => `${paragraph(GROWING_ANSWER.before + at + 1)}\n\n`,
  );
  app.mockAgent.willReply(more.join(""));
  await aReadySessionOpenInTheBrowser(app);
  await app.page.sendsMessage("Write a lot");
  await expectStreamToShow(app, paragraph(GROWING_ANSWER.before));
  return { app, hold };
}

/** The same, and the reader scrolled up before the chunk arrived. */
export async function aSessionWhoseReaderScrolledUpBeforeALargeChunk() {
  const { app, hold } = await aSessionWhoseAnswerGrowsByOneLargeChunk();
  await app.page.scrollsTheStreamUp(400);
  return { app, hold, offersJump: () => expectJumpToLatestOffered(app) };
}
