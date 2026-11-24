import type { QuietTerminalReading, SlowReading } from "../setup/slow-terminal-reader.ts";

/** Well under the amount printed: what waits for a slow reader is bounded, whatever is printed. */
const MOST_THAT_MAY_HAVE_BEEN_SENT = 30_000_000;

/** Of what the shell printed, only a small part was sent, and the text says output was skipped. */
export function expectOutputToHaveBeenCutShort(
  reading: SlowReading,
  call: { printed: number },
): void {
  const sent = reading.receivedBytes;
  if (sent > MOST_THAT_MAY_HAVE_BEEN_SENT) {
    const printed = String(call.printed);
    throw new Error(
      `expected the relay to drop most of the ${printed} bytes the shell printed, but it sent ${String(sent)}`,
    );
  }
  if (!reading.text.includes("[output skipped]")) {
    throw new Error("expected the output to say it was skipped, but it did not");
  }
}

/** The last line the shell printed arrived, after the part that was dropped. */
export function expectTheEndOfTheOutputToHaveArrived(reading: SlowReading, line: string): void {
  if (reading.text.includes(line)) return;
  throw new Error(`expected the output to end with "${line}", but it never arrived`);
}

/**
 * The shell printed the numbers 1 to `last`, one per line, and ended. Either the last number arrived
 * (nothing at the end was dropped), or the output says that what came after the last number it did
 * show was skipped. Which of the two happens depends on how the shell's output was cut into pieces,
 * but losing the end without saying so must never happen.
 */
export function expectNoLossAtTheEndToGoUnsaid(reading: SlowReading, last: number): void {
  const { number, after } = lastNumberShown(reading.text);
  if (number === String(last) || after.includes("[output skipped]")) return;
  throw new Error(
    `expected the end of the output to arrive or to be marked as skipped, but after the number ${number} it reads ${JSON.stringify(after.slice(0, 80))}`,
  );
}

/** The last run of digits the output shows (the shell printed numbers), and what follows it. */
function lastNumberShown(text: string): { number: string; after: string } {
  const shown = [...text.matchAll(/\d{5,}/g)].at(-1);
  if (shown === undefined) return { number: "none", after: text };
  return { number: shown[0], after: text.slice(shown.index + shown[0].length) };
}

/** The quiet terminal's output arrived whole: only the flooding terminal's output was dropped. */
export function expectTheQuietTerminalToHaveShownEverything(
  reading: QuietTerminalReading,
  call: { letter: string; printed: number },
): void {
  const shown = reading.text.split(call.letter).length - 1;
  if (shown >= call.printed) return;
  throw new Error(
    `expected the quiet terminal to show all ${String(call.printed)} "${call.letter}" it printed, but it showed ${String(shown)}`,
  );
}
