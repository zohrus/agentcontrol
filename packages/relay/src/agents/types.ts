import type { AgentKind } from "@agentcontrol/protocol";

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
}

export type MessageDirection = "to-agent" | "from-agent";

export interface StartAgentOptions {
  kind: AgentKind;
  cwd: string;
  /** Extra env vars for the agent process (ports etc.). */
  env: Record<string, string>;
  /** The relay's own environment: where agent commands are looked up and what the agent inherits. */
  hostEnv: Record<string, string | undefined>;
  /** Called with every raw JSON-RPC message, in both directions, unchanged, in wire order. */
  onMessage: (direction: MessageDirection, message: unknown) => void;
  /** Called when the agent asks for permission; the agent waits until the promise resolves. */
  onPermissionRequest: (request: PermissionRequest) => Promise<PermissionAnswer>;
}
