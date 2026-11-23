import type { SessionId } from "../../packages/sdk/src/index.ts";
import type { World } from "./world.ts";

/** What the scenarios of one run share: the world they run in and the session they build up. */
interface Flow {
  sessionId?: SessionId;
}

/** What a scenario may use: its world, a way to report findings, and the shared flow. */
export interface Run {
  readonly world: World;
  readonly flow: Flow;
  /** A finding to print under the scenario's PASS or FAIL line. */
  note(text: string): void;
  /** Where to save the relay's event log of a session as a recording, when asked to record. */
  record(options: { id: SessionId; name: string }): Promise<void>;
}

export interface Scenario {
  /** The letter used in reports, e.g. "a". */
  id: string;
  name: string;
  /**
   * "flow": runs in the world shared by the flow scenarios, in order, on one session.
   * "own": gets a fresh world of its own.
   * "modify": a fresh world whose app can change its own UI.
   */
  world: "flow" | "own" | "modify";
  run(run: Run): Promise<void>;
}
