import type { QuietTerminalReading, SlowReading } from "../setup/slow-terminal-reader.ts";

/** Of what the shell printed, only a small part was sent, and the text says output was skipped. */
export function expectOutputToHaveBeenCutShort(
  reading: SlowReading,
  call: { printed: number },
): void {
  const sent = reading.receivedBytes;
  // What waits for a slow reader is bounded, whatever is printed: well under half of it.
  if (sent > call.printed / 2) {
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
 * The shell printed the numbers 1 to `last`, one per line, and ended in the middle of the flood.
 * The output says it skipped some, and still ends with the last number, however the shell's output
 * was cut into pieces.
 */
export function expectTheEndOfTheNumbersToHaveArrived(reading: SlowReading, last: number): void {
  if (!reading.text.includes("[output skipped]")) {
    throw new Error("expected the output to say it was skipped, but it did not");
  }
  const shown = [...reading.text.matchAll(/\d{5,}/g)].at(-1)?.[0] ?? "none";
  if (shown === String(last)) return;
  throw new Error(
    `expected the output to end with the number ${String(last)}, but it ends with ${shown}`,
  );
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
