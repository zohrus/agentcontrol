import type { SessionSummary } from "@agentcontrol/protocol";
import { agentLabel, StatusDot } from "../session-list/index.ts";
import { ElapsedTime, type SessionUsage, UsageChip } from "../status/index.ts";

type Props = { summary: SessionSummary; usage?: SessionUsage | undefined };

const note = "shrink-0 font-mono text-[11px] text-muted";

/**
 * Title, agent, repository, branch, status, elapsed time and usage of the open session. It is one
 * line of fixed height: the title and the paths give way (and are cut) before anything wraps.
 */
export function SessionHeader({ summary, usage }: Props) {
  return (
    <header className="flex h-11 flex-none items-center gap-x-3.5 overflow-hidden whitespace-nowrap border-b border-line px-4">
      <h4 className="m-0 min-w-12 shrink truncate text-[15px] font-semibold">{summary.title}</h4>
      <span className={note}>{agentLabel(summary.agent)}</span>
      <span className="min-w-0 shrink truncate font-mono text-[11px] text-muted">
        {summary.repoPath}
      </span>
      <span className="min-w-0 shrink truncate font-mono text-[11px] text-muted">
        {summary.branch}
      </span>
      {summary.baseBranch !== "" && <span className={note}>from {summary.baseBranch}</span>}
      <span className={`${note} flex items-center gap-1.5`}>
        <StatusDot status={summary.status} />
        {summary.status}
      </span>
      <span className="shrink-0 tabular-nums">
        <ElapsedTime since={summary.createdAt} until={summary.archivedAt} />
      </span>
      {usage && (
        <span className="shrink-0 tabular-nums">
          <UsageChip usage={usage} />
        </span>
      )}
    </header>
  );
}
