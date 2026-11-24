import type { MockAgentScript } from "../mock-agent/script.ts";

/** What the mock agent offers beyond its steps: modes, and loading an earlier session. */
export interface MockAgentOptions {
  /**
   * The agent behaves like the Claude Code adapter: it offers the same permission modes, starts in
   * this one, and asks before running a command only in "default" (Manual).
   */
  startsInMode(modeId: string): void;
  /** The request to change the mode is refused, as when the user's Claude Code policy forbids it. */
  refusesToChangeMode(): void;
  /**
   * The agent says it can load an earlier session (ACP `loadSession`), and when it does it replays
   * `history` as messages first, as the real adapters do.
   */
  canLoadEarlierSession(history?: string[]): void;
  /** The agent says it can load an earlier session, but loading fails with an error. */
  failsToLoadEarlierSession(): void;
  /** The agent process exits by itself a moment after it started, before any prompt. */
  diesRightAfterStarting(): void;
  /** The agent is slow to start: it answers `session/new` only once a file exists at this path. */
  startsWhenFileExists(path: string): void;
  /** The agent process is slow to boot: it answers nothing, `initialize` included, for this long. */
  bootsInMs(ms: number): void;
  /** The agent process does not listen until a file exists at this path. */
  bootsWhenFileExists(path: string): void;
  /** The agent ignores SIGTERM, so only a kill stops it. */
  ignoresTheStopSignal(): void;
}

/** The options of one script, set by writing into it. */
export function optionsOf(script: MockAgentScript): MockAgentOptions {
  return {
    startsInMode: (modeId) => {
      script.startsInMode = modeId;
    },
    refusesToChangeMode: () => {
      script.refusesModeChange = true;
    },
    canLoadEarlierSession: (history = []) => {
      script.loadSession = { history };
    },
    failsToLoadEarlierSession: () => {
      script.loadSession = { history: [], fails: true };
    },
    diesRightAfterStarting: () => {
      script.exitsAfterStarting = true;
    },
    startsWhenFileExists: (path) => {
      script.startsWhenFileExists = path;
    },
    ...processOptionsOf(script),
  };
}

/** How the agent's process boots and ends, as opposed to what the agent does in a session. */
function processOptionsOf(
  script: MockAgentScript,
): Pick<MockAgentOptions, "bootsInMs" | "bootsWhenFileExists" | "ignoresTheStopSignal"> {
  return {
    bootsInMs: (ms) => {
      script.bootsAfterMs = ms;
    },
    bootsWhenFileExists: (path) => {
      script.bootsWhenFileExists = path;
    },
    ignoresTheStopSignal: () => {
      script.ignoresTheStopSignal = true;
    },
  };
}
