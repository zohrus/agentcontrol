/** Past this much unread output, big pieces of output are dropped; small ones (a prompt) still pass. */
const SOFT_LIMIT_BYTES = 4 * 1024 * 1024;
/** Past this much unread output, everything is dropped. */
const HARD_LIMIT_BYTES = 8 * 1024 * 1024;
/** A piece of output no bigger than this is a prompt or a short line, not a flood. */
const SMALL_PIECE = 1024;

/** What the client sees where output was dropped. */
const SKIPPED_MARKER = "\r\n[output skipped]\r\n";

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
 */
export function limitedOutput(call: {
  unread: () => number;
  send: (text: string) => void;
}): LimitedOutput {
  let skipping = false;
  const say = (): void => {
    if (skipping) call.send(SKIPPED_MARKER);
    skipping = false;
  };
  return {
    write: (text) => {
      if (isDropped({ unread: call.unread(), text })) {
        skipping = true;
        return;
      }
      say();
      call.send(text);
    },
    end: say,
  };
}
