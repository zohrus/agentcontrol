/** Past this much unread output, big pieces of output are dropped; small ones (a prompt) still pass. */
const SOFT_LIMIT_BYTES = 4 * 1024 * 1024;
/** Past this much unread output, everything is dropped. */
const HARD_LIMIT_BYTES = 8 * 1024 * 1024;
/** A piece of output no bigger than this is a prompt or a short line, not a flood. */
const SMALL_PIECE = 1024;

/** What the client sees where output was dropped. */
const SKIPPED_MARKER = "\r\n[output skipped]\r\n";

/** Of what was dropped, this much of the end is kept, and shown after the marker. */
const TAIL_CHARS = 64 * 1024;

/** The last part of what was dropped, kept as pieces so a long flood never copies it again. */
interface Tail {
  keep(text: string): void;
  /** Hands over what is kept and starts again. */
  take(): string;
}

/** Where a tail that was cut starts: after the first line end near the cut, not in an escape code. */
function startOfWholeLines(text: string): string {
  const lineEnd = text.indexOf("\n");
  return lineEnd >= 0 && lineEnd < 1024 ? text.slice(lineEnd + 1) : text;
}

function droppedTail(): Tail {
  let pieces: string[] = [];
  let first = 0;
  let length = 0;
  const firstLength = (): number => pieces[first]?.length ?? 0;
  const compact = (): void => {
    if (first < 1024) return;
    pieces = pieces.slice(first);
    first = 0;
  };
  return {
    keep: (text) => {
      const piece = text.length > TAIL_CHARS ? text.slice(-TAIL_CHARS) : text;
      pieces.push(piece);
      length += piece.length;
      while (length - firstLength() >= TAIL_CHARS) {
        length -= firstLength();
        first++;
      }
      compact();
    },
    take: () => {
      const kept = pieces.slice(first).join("");
      pieces = [];
      first = 0;
      length = 0;
      return kept.length > TAIL_CHARS ? startOfWholeLines(kept.slice(-TAIL_CHARS)) : kept;
    },
  };
}

function isDropped(call: { unread: number; text: string }): boolean {
  if (call.unread > HARD_LIMIT_BYTES) return true;
  return call.unread > SOFT_LIMIT_BYTES && call.text.length > SMALL_PIECE;
}

/** A shell's output on its way to a client. */
interface LimitedOutput {
  write(text: string): void;
  /** The shell has ended: says so if output was dropped and nothing came after it. */
  end(): void;
}

/**
 * Passes a shell's output on while the client keeps up. When a lot is waiting to be read (a program
 * like `yes` writes faster than anyone can read), output is dropped instead of piling up in the
 * relay's memory, and one marker says so once output flows again. Short pieces, such as the prompt
 * that follows a flood, are dropped only past the hard limit, so a reader that catches up still
 * sees where the shell stands.
 *
 * The end of what was dropped (the last 64 KiB) is kept and sent after the marker, once output flows
 * again or the shell ends, so the output always ends with what the shell printed last, whatever the
 * size of the pieces it came in. What is held is bounded: the unread output plus that tail (64 KiB,
 * and one piece of output at most).
 */
export function limitedOutput(call: {
  unread: () => number;
  send: (text: string) => void;
}): LimitedOutput {
  let skipping = false;
  const tail = droppedTail();
  const say = (): void => {
    if (skipping) call.send(SKIPPED_MARKER + tail.take());
    skipping = false;
  };
  return {
    write: (text) => {
      if (isDropped({ unread: call.unread(), text })) {
        skipping = true;
        tail.keep(text);
        return;
      }
      say();
      call.send(text);
    },
    end: say,
  };
}
