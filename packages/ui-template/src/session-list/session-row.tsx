import { Badge, cn } from "../components/index.ts";
import { agentLabel, waitingLabel } from "./labels.ts";
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
  return detail ?? `${agentLabel(summary.agent)} · ${summary.status}`;
}

/** The default session row: status dot, title, waiting badge and a detail line. */
export function SessionRow({ entry, selected, onSelect }: SessionRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left",
        selected ? "bg-surface shadow-[0_0_0_1px_var(--line)]" : "hover:bg-code",
      )}
    >
      <b className="flex items-center gap-1.5 font-medium">
        <StatusDot status={entry.summary.status} />
        <span className="truncate">{entry.summary.title}</span>
        <WaitingBadge entry={entry} />
      </b>
      <span className="truncate pl-3.5 text-[11px] text-muted">{detailText({ entry })}</span>
    </button>
  );
}
