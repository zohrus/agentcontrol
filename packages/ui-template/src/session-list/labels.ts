import type { AgentKind, SessionStatus, WaitingReason } from "@agentcontrol/protocol";

const agentNames: Record<AgentKind, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  mock: "Mock agent",
};

const waitingNames: Record<WaitingReason, string> = {
  permission: "approve",
  reply: "reply",
  "setup-failed": "setup failed",
};

/** How a session status is shown in the status dot. */
export type DotKind = "run" | "wait" | "done" | "fail" | "idle";

const dotKinds: Record<SessionStatus, DotKind> = {
  starting: "run",
  running: "run",
  waiting: "wait",
  idle: "idle",
  done: "done",
  failed: "fail",
  archived: "idle",
};

export function agentLabel(agent: AgentKind): string {
  return agentNames[agent];
}

export function waitingLabel(reason: WaitingReason): string {
  return waitingNames[reason];
}

export function dotKind(status: SessionStatus): DotKind {
  return dotKinds[status];
}
