import type { Page } from "./playwright.ts";
import { STREAM_RECORDER_SCRIPT } from "./stream-recorder-script.ts";

/** What the page showed of one message (a reply) after one change of the page. */
export type StreamSample = {
  /** Which reply on the page, from the top; -1 when the page shows no reply. */
  message: number;
  /** Its blocks, top to bottom: the element's identity and tag. */
  blocks: { id: number; tag: string }[];
  /** The text it shows. */
  text: string;
  tables: number;
  /** Whether a permission card was on the page. */
  permission: boolean;
  /** The thinking boxes on the page: the height they show, and their scroll position. */
  thoughts: { height: number; scrollTop: number; scrollHeight: number }[];
};

export type StreamRecording = {
  samples: StreamSample[];
  /** The tags of blocks taken out of a reply. */
  removedBlocks: string[];
  /** How many times the page changed, and how long each long task of the browser took (ms). */
  commits: number;
  longTasks: number[];
};

const THINKING_BOX_HEIGHT =
  "document.querySelector('[data-testid=thought]').firstElementChild.clientHeight";

const HIDE_THE_TAB = `(() => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new Event("visibilitychange"));
})()`;

/** What the test reads from the recording the page keeps. */
function recorded(page: Page) {
  return {
    /** Starts recording; it carries over a reload of the page. */
    startsRecording: async (): Promise<void> => {
      await page.addInitScript(STREAM_RECORDER_SCRIPT);
      await page.evaluate(STREAM_RECORDER_SCRIPT);
    },
    /** Everything recorded so far. */
    recording: (): Promise<StreamRecording> =>
      page.evaluate<StreamRecording>("window.__stream.state"),
    /** Remembers the element of this block of this reply, to ask later whether it is still the one shown. */
    remembersBlock: async (call: { message: number; block: number }): Promise<void> => {
      await page.evaluate(`window.__stream.pin(${String(call.message)}, ${String(call.block)})`);
    },
    /** Whether the remembered element is still on the page, in the same place. */
    rememberedBlockIsStillShown: (call: { message: number; block: number }): Promise<boolean> =>
      page.evaluate<boolean>(
        `window.__stream.pinnedIsStillThere(${String(call.message)}, ${String(call.block)})`,
      ),
  };
}

/** What the test does to the page while a reply streams. */
function doings(page: Page) {
  return {
    /** Presses "Show more" under the agent's thinking. */
    expandsTheThinking: () => page.getByRole("button", { name: "Show more" }).click(),
    /** How high the box of the first thinking is now. */
    thinkingBoxHeight: (): Promise<number> => page.evaluate<number>(THINKING_BOX_HEIGHT),
    /** The browser tab goes to the background. */
    goesToTheBackground: async (): Promise<void> => {
      await page.evaluate(HIDE_THE_TAB);
    },
    /** The animation frames and timers of the page run for this long (needs a controllable clock). */
    letsFramesRun: (milliseconds: number) => page.clock.runFor(milliseconds),
    /** Stops the page's clock where it is, so frames come only through `letsFramesRun`. */
    stopsTheClock: () => page.clock.pauseAt(new Date(Date.now() + 1000)),
  };
}

/** Watches how the conversation changes while it streams, from inside the page. */
export const streamRecorder = (page: Page) => ({ ...recorded(page), ...doings(page) });

export type StreamRecorder = ReturnType<typeof streamRecorder>;
