import type { Client, SessionEvent } from "@agentcontrol/sdk";
import type { MockAgent } from "./mock-agent-script.ts";
import type { Session } from "./relay.ts";
import type { Timeline } from "./timeline.ts";

export type { Session };

/** Paths that changed in a session's worktree, as the live stream reports them. */
export interface FileChange {
  sessionId: Session["id"];
  paths: string[];
}

/** What helpers may use of a running app: the SDK a user's browser would use, and what it heard. */
export interface AppAccess {
  /** The SDK, connected to the app as it is now (it changes when the app restarts). */
  readonly sdk: Client;
  /** Where the app listens now, e.g. `http://127.0.0.1:41234`. */
  readonly baseUrl: string;
  /** The secret the app generated at its last start, as its token file holds it. */
  readonly token: string;
  readonly mockAgent: MockAgent;
  /** The app's data folder: the live UI is `<dataDir>/ui`. */
  readonly dataDir: string;
  readonly repoPath: string;
  /** Every session event the live stream has delivered since the test began. */
  readonly streamed: Timeline<SessionEvent>;
  /** Every worktree change the live stream has reported since the test began. */
  readonly fileChanges: Timeline<FileChange>;
  /** One entry per relay connection the app has seen end, numbered from 1. */
  readonly relayConnectionsEnded: Timeline<number>;
}
