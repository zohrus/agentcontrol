/** Characters shown per second when the text arrives no faster than that. */
const BASE_CHARS_PER_SECOND = 90;
/** A backlog of more than this much text (about 120 ms of it at the base pace) is drained faster. */
const BACKLOG_LIMIT_CHARS = (BASE_CHARS_PER_SECOND * 120) / 1000;
/** Over how long a larger backlog is drained (it is down to about 2% after this long). */
const DRAIN_MS = 250;
/** The backlog shrinks by a share of `elapsed / this` per frame. */
const DRAIN_TIME_CONSTANT_MS = DRAIN_MS / 4;
/** A frame that comes later than this (a busy page) is counted as this long. */
const LONGEST_FRAME_MS = 250;
const FIRST_FRAME_MS = 16;
/** A word longer than this is cut where the pace says, not at its end. */
const LONGEST_WORD = 40;

/** How much of a text is shown: `shown` whole characters, `at` the exact place, `frame` the time of the last frame (none once caught up). */
export type Pace = { shown: number; at: number; frame: number | undefined };

export const startPace = (length: number): Pace => ({
  shown: length,
  at: length,
  frame: undefined,
});

/** The start of the word after the last space at or before `limit`, when it is past `from`. */
function wordStart(text: string, call: { from: number; limit: number }): number | undefined {
  const { from, limit } = call;
  for (let index = limit; index > from; index--) {
    if (/\s/.test(text[index - 1] ?? "")) return index;
  }
  return undefined;
}

/** How many characters the pace moves on in the time since the last frame. */
function stepOf(backlog: number, elapsedMs: number): number {
  const base = (BASE_CHARS_PER_SECOND * elapsedMs) / 1000;
  if (backlog <= BACKLOG_LIMIT_CHARS) return base;
  return Math.max(base, (backlog * elapsedMs) / DRAIN_TIME_CONSTANT_MS);
}

/**
 * The pace one frame (at time `now`) later: it moves on at the base pace, faster when the backlog
 * is large, and the text shown stops at the start of a word. It never goes back.
 */
export function advancePace(text: string, call: { pace: Pace; now: number }): Pace {
  const { pace, now } = call;
  const elapsed = pace.frame === undefined ? FIRST_FRAME_MS : now - pace.frame;
  const backlog = text.length - pace.at;
  const at = Math.min(text.length, pace.at + stepOf(backlog, Math.min(elapsed, LONGEST_FRAME_MS)));
  const limit = Math.floor(at);
  if (limit >= text.length) return { shown: text.length, at, frame: undefined };
  const start = wordStart(text, { from: pace.shown, limit });
  const cutInWord = limit - pace.shown > LONGEST_WORD;
  return { shown: start ?? (cutInWord ? limit : pace.shown), at, frame: now };
}
