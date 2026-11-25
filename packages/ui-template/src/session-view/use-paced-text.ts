import { useCallback, useEffect, useRef, useState } from "react";
import { advancePace, type Pace, startPace } from "./pace.ts";

/** Where animation frames come from: the page's own (a test controls them with the page's clock). */
export type FrameSource = {
  request: (run: (now: number) => void) => number;
  cancel: (id: number) => void;
};

const browserFrames: FrameSource = {
  request: (run) => requestAnimationFrame(run),
  cancel: (id) => {
    cancelAnimationFrame(id);
  },
};

type Pacing = {
  text: string;
  frames: FrameSource;
  pace: { current: Pace };
  show: (n: number) => void;
};

/** Moves the pace one frame at a time until the whole text is shown; returns what stops it. */
function runFrames(pacing: Pacing): () => void {
  const { text, frames, pace, show } = pacing;
  let id: number | undefined;
  const frame = (now: number): void => {
    id = undefined;
    pace.current = document.hidden
      ? startPace(text.length)
      : advancePace(text, { pace: pace.current, now });
    show(pace.current.shown);
    if (pace.current.shown < text.length) id = frames.request(frame);
  };
  if (pace.current.shown < text.length) id = frames.request(frame);
  return () => {
    if (id !== undefined) frames.cancel(id);
  };
}

/** The pace after the first frame of a text that has just begun. */
const firstPace = (text: string): Pace => ({
  ...advancePace(text, { pace: startPace(0), now: 0 }),
  frame: undefined,
});

/** Shows everything now, and again when the tab is hidden (a hidden tab gets no frames). */
function useFlushWhenHidden(call: { live: boolean; flush: () => void }): void {
  const { live, flush } = call;
  useEffect(() => {
    if (!live) return undefined;
    const onChange = (): void => {
      if (document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [live, flush]);
}

/**
 * The text of a message that is still arriving, revealed at a steady pace (see `pace.ts`) so it
 * reads smoothly whatever the size of the chunks. What is not live is shown whole, and so is all
 * of it the moment `live` ends or the tab is hidden. What is shown never gets shorter.
 */
export function usePacedText(
  call: { text: string; live: boolean; fresh: boolean },
  frames: FrameSource = browserFrames,
): string {
  const { text, live } = call;
  // A text that began while the page watched is revealed from its start; any other is shown whole.
  const [first] = useState(() => (call.fresh && live ? firstPace(text) : startPace(text.length)));
  const [shown, setShown] = useState(first.shown);
  const pace = useRef<Pace>(first);
  useEffect(() => {
    // A hidden tab gets no frames: everything is shown at once.
    if (live && !document.hidden) return runFrames({ text, frames, pace, show: setShown });
    pace.current = startPace(text.length);
    setShown(text.length);
    return undefined;
  }, [text, live, frames]);
  const { length } = text;
  const flush = useCallback((): void => {
    pace.current = startPace(length);
    setShown(length);
  }, [length]);
  useFlushWhenHidden({ live, flush });
  return live ? text.slice(0, Math.min(shown, text.length)) : text;
}
