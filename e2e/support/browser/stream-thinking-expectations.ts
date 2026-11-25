import type { StreamRecorder, StreamRecording } from "./stream-recorder.ts";

const LINE_PX = 16;

/** The thinking box never grew past this many lines, and it was scrolled to its end while it overflowed. */
export function expectThoughtBoxStayedWithinLines(call: {
  recording: StreamRecording;
  lines: number;
}): void {
  const boxes = call.recording.samples.flatMap((sample) => sample.thoughts);
  if (boxes.length === 0) throw new Error("expected a thinking box to be shown, but none was");
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

/** The (first) thinking box is no taller than this many lines now. */
export async function expectThinkingBoxToBeAtMostLines(call: {
  stream: StreamRecorder;
  lines: number;
}): Promise<void> {
  const height = await call.stream.thinkingBoxHeight();
  if (height > call.lines * LINE_PX) {
    throw new Error(
      `expected the thinking box to be at most ${String(call.lines)} lines high, but it is ${String(height)} px`,
    );
  }
}

/** The (first) thinking box is taller than this many lines now. */
export async function expectThinkingBoxToBeMoreThanLines(call: {
  stream: StreamRecorder;
  lines: number;
}): Promise<void> {
  const height = await call.stream.thinkingBoxHeight();
  if (height <= call.lines * LINE_PX) {
    throw new Error(
      `expected the thinking box to be more than ${String(call.lines)} lines high, but it is ${String(height)} px`,
    );
  }
}
