/** What a terminal needs to start, and who to tell what happens. */
export interface OpenTerminal {
  /** Size in characters. Send `resize` when the view changes. */
  cols: number;
  rows: number;
  /** The shell's output, as text. Characters are never split between calls. */
  onData(text: string): void;
  /** The shell ended. `exitCode` is null when a signal ended it, or when the terminal was lost. */
  onExit(exitCode: number | null): void;
  /**
   * The terminal could not start or was lost (the workspace went offline, the session was
   * archived, the app refused the connection). The message is plain language. `onExit` follows.
   */
  onError?: ((message: string) => void) | undefined;
}

/** A running terminal. Everything is safe to call after it ended: it does nothing. */
export interface Terminal {
  /** Types text into the shell. */
  write(data: string): void;
  resize(size: { cols: number; rows: number }): void;
  /** Ends the shell and the connection. */
  close(): void;
}

/** What the page needs to find the app and prove who it is. */
export interface TerminalConnection {
  baseUrl: string;
  /** The app's secret; read from the page when left out, like every other call. */
  token: () => string | undefined;
  /**
   * Asks the app, with the secret, how it answers a plain request to `url`; a 401 reaches the
   * client's `onUnauthorized` like any other. A browser is not told why a socket was refused.
   */
  statusOf: (url: string) => Promise<number | undefined>;
}
