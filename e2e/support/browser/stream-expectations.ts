import type { StreamRecording, StreamSample } from "./stream-recorder.ts";

const quote = (text: string): string => JSON.stringify(text);

/** The samples of one reply, in the order they were taken. */
const samplesOf = (recording: StreamRecording, message: number): StreamSample[] =>
  recording.samples.filter((sample) => sample.message === message);

/** The replies the page showed, by their index. */
const messagesIn = (recording: StreamRecording): number[] => [
  ...new Set(recording.samples.map((s) => s.message).filter((index) => index >= 0)),
];

type Pair = { before: StreamSample; after: StreamSample };

/** Each sample with the one taken just before it. */
const consecutive = (samples: StreamSample[]): Pair[] =>
  samples.slice(1).flatMap((after, at) => {
    const before = samples[at];
    return before === undefined ? [] : [{ before, after }];
  });

/** Each sample of each reply with the one of the same reply taken just before it. */
const pairsOf = (recording: StreamRecording): Pair[] =>
  messagesIn(recording).flatMap((message) => consecutive(samplesOf(recording, message)));

type Block = StreamSample["blocks"][number];

const sameBlock = (a: Block | undefined, b: Block): boolean => a?.id === b.id && a.tag === b.tag;

/** Which block of the earlier sample is no longer the same element at its place in the later one. */
const movedBlock = ({ before, after }: Pair): number =>
  before.blocks.findIndex((block, at) => !sameBlock(after.blocks[at], block));

function describeRedrawn(pair: Pair, at: number): string {
  const was = pair.before.blocks[at]?.tag ?? "nothing";
  const now = pair.after.blocks[at]?.tag ?? "nothing";
  return `block ${String(at + 1)} was <${was}> and then became <${now}> (after ${quote(pair.before.text)})`;
}

/** Every block shown once stays the same element, with the same tag, for as long as the reply streams. */
export function expectNothingAlreadyShownWasRedrawn(recording: StreamRecording): void {
  for (const pair of pairsOf(recording)) {
    const at = movedBlock(pair);
    if (at >= 0) {
      throw new Error(
        `expected nothing already shown to be redrawn, but ${describeRedrawn(pair, at)}`,
      );
    }
  }
}

/** The text of a reply only ever grows. */
export function expectShownTextNeverGotShorter(recording: StreamRecording): void {
  const shorter = pairsOf(recording).find(
    ({ before, after }) => after.text.length < before.text.length,
  );
  if (shorter !== undefined) {
    throw new Error(
      `expected the shown text never to get shorter, but ${quote(shorter.before.text)} became ${quote(shorter.after.text)}`,
    );
  }
}

/** None of these marker characters was on the page at any moment: they are held back or closed, never shown. */
export function expectMarkersWereNeverShown(recording: StreamRecording, markers: string[]): void {
  for (const sample of recording.samples) {
    const seen = markers.find((marker) => sample.text.includes(marker));
    if (seen !== undefined) {
      throw new Error(
        `expected ${quote(seen)} never to be shown, but the page showed ${quote(sample.text)}`,
      );
    }
  }
}

/** The table was drawn only once its delimiter row had arrived: until then no pipe was on the page. */
export function expectTableAppearedOnlyOnceComplete(recording: StreamRecording): void {
  expectMarkersWereNeverShown(recording, ["|"]);
  const drawn = recording.samples.some((sample) => sample.tables === 1);
  if (!drawn) throw new Error("expected the reply to be drawn as a table, but no table was shown");
}

/** The reply was revealed in more steps than it arrived in chunks. */
export function expectReplyWasRevealedGradually(call: {
  recording: StreamRecording;
  chunks: number;
}): void {
  const steps = new Set(samplesOf(call.recording, 0).map((sample) => sample.text.length));
  if (steps.size <= call.chunks) {
    throw new Error(
      `expected the reply to be revealed in more than ${String(call.chunks)} steps, but it showed ${String(steps.size)} different lengths`,
    );
  }
}

/** Whenever a permission card was on the page, the reply above it was shown in full. */
export function expectReplyWasWholeWhenTheCardAppeared(call: {
  recording: StreamRecording;
  reply: string;
}): void {
  const early = call.recording.samples.find(
    (sample) => sample.permission && sample.message === 0 && sample.text !== call.reply,
  );
  if (early !== undefined) {
    throw new Error(
      `expected the whole reply to be shown when the permission card appeared, but it showed ${quote(early.text)}`,
    );
  }
}

/** The first time the page showed the reply, it showed all of it. */
export function expectReplyWasShownWholeAtOnce(call: {
  recording: StreamRecording;
  reply: string;
}): void {
  const first = samplesOf(call.recording, 0).find((sample) => sample.text !== "");
  if (first?.text !== call.reply) {
    throw new Error(
      `expected the reply to be shown whole at once, but it first showed ${quote(first?.text ?? "")}`,
    );
  }
}

const LINE_PX = 16;

/** The thinking box never grew past this many lines, and it was scrolled to its end while it overflowed. */
export function expectThoughtBoxStayedWithinLines(call: {
  recording: StreamRecording;
  lines: number;
}): void {
  const boxes = call.recording.samples.flatMap((sample) => sample.thoughts);
  const tallest = Math.max(...boxes.map((box) => box.height));
  if (tallest > call.lines * LINE_PX) {
    throw new Error(
      `expected the thinking box to stay within ${String(call.lines)} lines, but it was ${String(tallest)} px high`,
    );
  }
  if (!boxes.some((box) => box.scrollHeight > box.height)) {
    throw new Error("expected the thinking to be longer than its box, but it fitted");
  }
}

/** While the thinking streamed, its box showed the newest line. */
export function expectThoughtBoxFollowedItsEnd(recording: StreamRecording): void {
  const lost = recording.samples
    .flatMap((sample) => sample.thoughts)
    .find(
      (box) => box.scrollHeight > box.height && box.scrollTop + box.height < box.scrollHeight - 1,
    );
  if (lost !== undefined) {
    throw new Error(
      `expected the thinking box to show its last line, but it was scrolled to ${String(lost.scrollTop)} of ${String(lost.scrollHeight)}`,
    );
  }
}
