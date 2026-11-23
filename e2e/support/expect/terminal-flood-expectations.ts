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

/** After the last of the flood that did arrive, the output says that the rest was skipped. */
export function expectTheCutToBeShownAfterTheLastOutput(reading: SlowReading): void {
  const afterTheFlood = reading.text.slice(reading.text.lastIndexOf("yyyy"));
  if (afterTheFlood.includes("[output skipped]")) return;
  throw new Error("expected the output to say that the end of it was skipped, but it did not");
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
