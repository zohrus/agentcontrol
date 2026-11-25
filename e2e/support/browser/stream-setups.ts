import { join } from "node:path";
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

/** An agent that streams this reply in chunks, in a session open in a browser that records the stream. */
export async function aSessionStreamingAReplyInChunks(call: {
  reply: string;
  size: number;
  /** The turn stays open after the reply until the test calls `endsTheTurn`. */
  holdsTheTurnOpen?: boolean;
}) {
  const app = await startAppInBrowser();
  const gate = join(app.mockAgent.dataFolder, "end-of-turn");
  app.mockAgent.willStreamReplyInChunks(call.reply, { size: call.size });
  if (call.holdsTheTurnOpen === true) app.mockAgent.willWaitForFile(gate);
  const { session, stream } = await aReadySessionWhoseStreamIsRecorded(app);
  const endsTheTurn = async (): Promise<void> => {
    await Bun.write(gate, "");
  };
  return { app, session, stream, endsTheTurn };
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
