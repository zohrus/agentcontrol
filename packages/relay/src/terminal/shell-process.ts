/** A shell running in a pseudo-terminal. */
export interface ShellProcess {
  write(data: string): void;
  resize(size: { cols: number; rows: number }): void;
  /** Hangs the shell up, and kills it if it ignores that; resolves once it is gone. */
  stop(): Promise<void>;
  /** Resolves when the shell has ended and all its output was handed to `onData`. */
  readonly finished: Promise<void>;
}

export interface ShellOptions {
  command: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
  /** Output as UTF-8 text; a character split across two reads is held back until it is whole. */
  onData(text: string): void;
  /** Called once, after the last output; null when a signal ended the shell. */
  onExit(exitCode: number | null): void;
}

/** How long output may still arrive after the shell ended (something it started may hold the pty). */
const OUTPUT_GRACE_MS = 200;
/** How long a hung-up shell has to end before it is killed. */
const HANGUP_GRACE_MS = 1000;

/** Sends the signal to the shell's whole process group (the pty makes it the group's leader). */
function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone: nothing left to signal.
  }
}

/** Starts the command with a pseudo-terminal; `outputEnded` is called when the pty reaches its end. */
function startInPty(options: ShellOptions, outputEnded: () => void): Bun.Subprocess {
  const decoder = new TextDecoder();
  return Bun.spawn(options.command, {
    cwd: options.cwd,
    env: options.env,
    terminal: {
      cols: options.cols,
      rows: options.rows,
      data: (_terminal, bytes) => {
        options.onData(decoder.decode(bytes, { stream: true }));
      },
      exit: outputEnded,
    },
  });
}

/** Hangs the shell up, then kills it if it has not ended after a grace period. */
async function stopShell(child: Bun.Subprocess): Promise<void> {
  // A shell that already ended may have left its process id to another program.
  if (child.exitCode !== null || child.signalCode !== null) return;
  signalGroup(child.pid, "SIGHUP");
  const timer = setTimeout(() => {
    signalGroup(child.pid, "SIGKILL");
    child.kill("SIGKILL");
  }, HANGUP_GRACE_MS);
  await child.exited;
  clearTimeout(timer);
  // What the shell started and left running ignores the hangup too: the group is still there.
  signalGroup(child.pid, "SIGKILL");
}

/** Starts the command in a pseudo-terminal; throws when it cannot be started (folder missing). */
export function spawnShell(options: ShellOptions): ShellProcess {
  let outputEnded = (): void => undefined;
  const outputDone = new Promise<void>((resolve) => {
    outputEnded = resolve;
  });
  const child = startInPty(options, () => {
    outputEnded();
  });
  const ended = (): boolean => child.exitCode !== null || child.signalCode !== null;
  const finished = child.exited.then(async (code) => {
    await Promise.race([outputDone, Bun.sleep(OUTPUT_GRACE_MS)]);
    options.onExit(child.signalCode === null ? code : null);
  });
  return {
    finished,
    write: (data) => {
      if (!ended()) child.terminal?.write(data);
    },
    resize: ({ cols, rows }) => {
      if (!ended()) child.terminal?.resize(cols, rows);
    },
    stop: () => stopShell(child),
  };
}
