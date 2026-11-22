import type {
  RelayMethodName,
  RelayParams,
  RelayResult,
  SessionEvent,
  SessionId,
} from "@agentcontrol/protocol";
import type { MockAgent } from "./mock-agent-script.ts";
import type { Timeline } from "./timeline.ts";

/** A session the user started: its id and the title the session list shows. */
export interface Session {
  readonly id: SessionId;
  readonly title: string;
}

/** What helpers may use of a running relay: its folders, a line to it, and what it has told us. */
export interface RelayAccess {
  readonly dataDir: string;
  readonly repoPath: string;
  readonly mockAgent: MockAgent;
  /** Calls a relay method over the app's current connection. */
  call<M extends RelayMethodName>(method: M, params: RelayParams<M>): Promise<RelayResult<M>>;
  /** The events the app's current connection has received. */
  readonly events: Timeline<SessionEvent>;
}
