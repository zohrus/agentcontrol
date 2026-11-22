import type { Client, SessionEvent } from "@agentcontrol/sdk";
import type { MockAgent } from "./mock-agent-script.ts";
import type { Session } from "./relay.ts";
import type { Timeline } from "./timeline.ts";

export type { Session };

/** What helpers may use of a running app: the SDK a user's browser would use, and what it heard. */
export interface AppAccess {
  /** The SDK, connected to the app as it is now (it changes when the app restarts). */
  readonly sdk: Client;
  readonly mockAgent: MockAgent;
  readonly repoPath: string;
  /** Every session event the live stream has delivered since the test began. */
  readonly streamed: Timeline<SessionEvent>;
}
