import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";
import type { StreamRecorder } from "./stream-recorder.ts";

const FRAME_MS = 20;
const WAIT_MS = 15_000;

const quote = (text: string): string => JSON.stringify(text);

/** Lets frames run, one after the other, until the conversation shows this text. */
export function letsFramesRunUntilTheConversationShows(call: {
  app: AppInBrowser;
  stream: StreamRecorder;
  text: string;
}): Promise<void> {
  const { app, stream, text } = call;
  return eventually(
    `expected the conversation to show ${quote(text)}`,
    async () => {
      await stream.letsFramesRun(FRAME_MS);
      const shown = await app.page.streamText();
      return shown.includes(text) ? undefined : `it shows ${quote(shown)}`;
    },
    WAIT_MS,
  );
}

/** Lets frames run until the first reply shows more than this many characters. */
export function letsFramesRunUntilTheReplyShowsMoreThan(call: {
  stream: StreamRecorder;
  length: number;
}): Promise<void> {
  const { stream, length } = call;
  return eventually(
    `expected the reply to show more than ${String(length)} characters`,
    async () => {
      await stream.letsFramesRun(FRAME_MS);
      const { samples } = await stream.recording();
      const shown = samples.findLast((sample) => sample.message === 0)?.text.length ?? 0;
      return shown > length ? undefined : `it shows ${String(shown)}`;
    },
    WAIT_MS,
  );
}
