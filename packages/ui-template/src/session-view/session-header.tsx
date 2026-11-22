import type { SessionSummary } from "@agentcontrol/protocol";
import { agentLabel, StatusDot } from "../session-list/index.ts";
import { ElapsedTime, type SessionUsage, UsageChip } from "../status/index.ts";

type Props = { summary: SessionSummary; usage?: SessionUsage | undefined };

/** Title, agent, repository, branch, status, elapsed time and usage of the open session. */
export function SessionHeader({ summary, usage }: Props) {
  return (
    <header className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 border-b border-line px-4 py-2.5">
      <h4 className="m-0 text-[15px] font-semibold">{summary.title}</h4>
      <span className="font-mono text-[11px] text-muted">{agentLabel(summary.agent)}</span>
      <span className="font-mono text-[11px] text-muted">{summary.repoPath}</span>
      <span className="font-mono text-[11px] text-muted">{summary.branch}</span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <StatusDot status={summary.status} />
        {summary.status}
      </span>
      <ElapsedTime since={summary.createdAt} until={summary.archivedAt} />
      {usage && <UsageChip usage={usage} />}
    </header>
  );
}
