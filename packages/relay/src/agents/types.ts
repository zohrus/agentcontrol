import type { AgentKind } from "@agentcontrol/protocol";
import type { Timed } from "../steps/index.ts";

/** The environment the relay reads its agent settings from (the process env, unless injected). */
export type HostEnv = Record<string, string | undefined>;

export interface PermissionRequest {
  requestId: string;
  toolCall: unknown;
  options: { optionId: string; name: string; kind: string }[];
}

export type PermissionAnswer = { optionId: string } | { cancelled: true };

export interface AgentProcess {
  /** Sends one user prompt; resolves when the turn ends. */
  prompt(text: string): Promise<{ stopReason: string }>;
  /** Asks the agent to cancel the current turn (ACP session/cancel). */
  cancel(): Promise<void>;
  /** Kills the agent process. */
  stop(): Promise<void>;
  /** Resolves when the process has exited, however that happened. */
  readonly exited: Promise<{ exitCode: number | null; signal?: string }>;
  /** The agent's own id for the session it works in (ACP session id); resuming loads it by this id. */
  readonly agentSessionId: string;
  /** True when this agent loaded the earlier session it was asked to continue. */
  readonly restored: boolean;
  /** When an earlier session was asked for but not loaded: why, in a few words. */
  readonly notRestoredBecause: string | undefined;
}

export type MessageDirection = "to-agent" | "from-agent";

/** An agent process that is up and has answered `initialize`, waiting for the folder it will work in. */
export interface PreparedAgent {
  /** Opens the agent's session in `cwd` (ACP `session/new` or `session/load`); ready for a prompt after. */
  open(call: {
    cwd: string;
    resume?: { agentSessionId: string };
    sessionMeta?: Record<string, unknown>;
  }): Promise<AgentProcess>;
  /** Stops the process without having opened a session, for when the folder could not be made. */
  discard(): Promise<void>;
}

export interface StartAgentOptions {
  kind: AgentKind;
  /** Where the process starts, and where the session opens unless `open` is given another folder. */
  cwd: string;
  /** Shows the steps of starting (installing the adapter, starting it, opening the session) with their times. */
  timed?: Timed;
  /** Extra env vars for the agent process (ports etc.). */
  env: Record<string, string>;
  /** Continue this earlier ACP session (`session/load`) when the agent can; else start a new one. */
  resume?: { agentSessionId: string };
  /** Sent as `_meta` of ACP `session/new`: launch-time settings the adapter understands. */
  sessionMeta?: Record<string, unknown>;
  /** The relay's own environment: where agent commands are looked up and what the agent inherits. */
  hostEnv: HostEnv;
  /** Called with every raw JSON-RPC message, in both directions, unchanged, in wire order. */
  onMessage: (direction: MessageDirection, message: unknown) => void;
  /** Called when the agent asks for permission; the agent waits until the promise resolves. */
  onPermissionRequest: (request: PermissionRequest) => Promise<PermissionAnswer>;
}
