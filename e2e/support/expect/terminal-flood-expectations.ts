import type { SlowReading } from "../setup/slow-terminal-reader.ts";

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
