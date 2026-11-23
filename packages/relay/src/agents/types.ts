import type { AgentKind } from "@agentcontrol/protocol";

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

export interface StartAgentOptions {
  kind: AgentKind;
  cwd: string;
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
