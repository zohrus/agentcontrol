import type { Terminal } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { Timeline } from "./timeline.ts";

const SCREEN_WAIT_MS = 8000;

/** One terminal the user has open: what it printed so far, and how it ended. */
export interface OpenShell {
  /** Everything the shell printed so far, grown by each chunk; every length is kept. */
  readonly screens: Timeline<string>;
  /** How the shell ended: its exit code (null: a signal), one entry at most. */
  readonly endings: Timeline<{ exitCode: number | null }>;
  /** The plain-language problems the app reported (workspace lost, connection refused). */
  readonly problems: Timeline<string>;
  /** Types a command and presses Enter. */
  types(command: string): void;
  /** Makes the terminal this many characters wide and tall. */
  resizesTo(size: { cols: number; rows: number }): void;
  /** Closes the terminal, as closing the tab does. */
  closes(): void;
  /** What the shell printed so far. */
  printed(): string;
}

type Heard = Pick<OpenShell, "screens" | "endings" | "problems" | "printed">;

/** Opens the terminal and records what it reports. */
function connect(app: AppAccess, call: { session: Session; cols: number; rows: number }) {
  const heard = {
    screens: new Timeline<string>(SCREEN_WAIT_MS),
    endings: new Timeline<{ exitCode: number | null }>(SCREEN_WAIT_MS),
    problems: new Timeline<string>(SCREEN_WAIT_MS),
  };
  let printed = "";
  const terminal: Terminal = app.sdk.terminal.open(call.session.id, {
    cols: call.cols,
    rows: call.rows,
    onData: (text) => {
      printed += text;
      heard.screens.record(printed);
    },
    onExit: (exitCode) => {
      heard.endings.record({ exitCode });
    },
    onError: (message) => {
      heard.problems.record(message);
    },
  });
  const read: Heard = { ...heard, printed: () => printed };
  return { terminal, read };
}

/** Opens a terminal on the session with the SDK, as the Terminal tab does. */
export function openShell(
  app: AppAccess,
  call: { session: Session; cols?: number; rows?: number },
): OpenShell {
  const { terminal, read } = connect(app, { cols: 80, rows: 24, ...call });
  return {
    ...read,
    types: (command) => {
      terminal.write(`${command}\n`);
    },
    resizesTo: (size) => {
      terminal.resize(size);
    },
    closes: () => {
      terminal.close();
    },
  };
}
