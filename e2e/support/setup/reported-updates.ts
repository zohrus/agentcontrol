import type { MockAgent } from "./mock-agent-script.ts";

/** The agent switches to plan mode, shows a warning notice and reports a connection error it will retry. */
export function agentWillSwitchModeShowNoticeAndReportConnectionError(agent: MockAgent): void {
  agent.willSendUpdate({ sessionUpdate: "current_mode_update", currentModeId: "plan" });
  agent.willSendUpdate({
    sessionUpdate: "notice",
    severity: "warning",
    title: "Rate limited",
    description: "Retrying in a minute",
  });
  const error = { message: "Connection lost", additionalDetails: "timeout", willRetry: true };
  agent.willSendUpdate({ sessionUpdate: "session_info_update", _meta: { codex: { error } } });
}
