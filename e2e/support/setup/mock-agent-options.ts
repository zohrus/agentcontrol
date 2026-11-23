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
  };
}
