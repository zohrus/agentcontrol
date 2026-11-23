import { Badge, cn } from "../components/index.ts";
import { agentLabel, waitingLabel } from "./labels.ts";
import { RowActions } from "./row-actions.tsx";
import { StatusDot } from "./status-dot.tsx";
import type { SessionRowProps } from "./types.ts";

function WaitingBadge({ entry }: Pick<SessionRowProps, "entry">) {
  const reason = entry.summary.waitingReason;
  if (!reason) return null;
  const tone = reason === "setup-failed" ? "failed" : "waiting";
  return (
    <Badge tone={tone} className="ml-auto">
      {waitingLabel(reason)}
    </Badge>
  );
}

function detailText({ entry }: Pick<SessionRowProps, "entry">): string {
  const { summary, detail } = entry;
  const readOnly = entry.readOnly ? " · read-only" : "";
  return detail ?? `${agentLabel(summary.agent)} · ${summary.status}${readOnly}`;
}

/** The default session row: status dot, title, waiting badge, detail line and Approve / Deny. */
export function SessionRow({ entry, selected, onSelect, onAnswerPermission }: SessionRowProps) {
  const { pendingPermission } = entry;
  return (
    <div
      data-session-item=""
      className={cn(
        "flex flex-col gap-0.5 rounded-md px-2 py-1.5",
        selected ? "bg-surface shadow-[0_0_0_1px_var(--line)]" : "hover:bg-code",
      )}
    >
      <button
        type="button"
        data-session-open=""
        onClick={onSelect}
        aria-current={selected}
        className="flex w-full flex-col gap-0.5 rounded-sm text-left"
      >
        <b className="flex items-center gap-1.5 font-medium">
          <StatusDot status={entry.summary.status} />
          <span className="truncate">{entry.summary.title}</span>
          <WaitingBadge entry={entry} />
        </b>
        <span className="truncate pl-3.5 text-[11px] text-muted">{detailText({ entry })}</span>
      </button>
      {pendingPermission && onAnswerPermission && (
        <RowActions permission={pendingPermission} onAnswer={onAnswerPermission} />
      )}
    </div>
  );
}
