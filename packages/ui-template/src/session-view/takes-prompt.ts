import type { SessionSummary } from "@agentcontrol/protocol";

const TAKES_A_PROMPT = new Set(["ready", "running", "idle", "waiting"]);

/** False when a queued message cannot be sent: setup failed, or the agent is gone. */
export const takesPrompt = ({ status, waitingReason }: SessionSummary): boolean =>
  waitingReason !== "setup-failed" && TAKES_A_PROMPT.has(status);
