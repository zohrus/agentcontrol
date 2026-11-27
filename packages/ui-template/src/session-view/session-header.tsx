import type { SessionSummary } from "@agentcontrol/protocol";
import type { SessionUsage } from "../status/index.ts";
import { type ChangeTotals, ChangesButton, CostNote } from "./header-numbers.tsx";
import { HeaderStatus } from "./header-status.tsx";
import { SessionDetails } from "./session-details.tsx";

type Props = {
  summary: SessionSummary;
  usage?: SessionUsage | undefined;
  /** Absent until the session's changes are known (and for an archived session). */
  changes?: ChangeTotals | undefined;
  onShowChanges: () => void;
  /** Omit when the session cannot be archived from here. */
  onArchive?: (() => void) | undefined;
};

/**
 * Status, title, changed files, cost and a Details button (the rest of what is known about the
 * session, and Archive). The title wraps, never cut; the numbers keep their room, so nothing
 * moves while the session streams.
 */
export function SessionHeader(props: Props) {
  const { summary } = props;
  return (
    <header className="relative flex min-h-10 flex-none items-center gap-2 border-b border-line py-1.5 pl-4 pr-2.5">
      <HeaderStatus status={summary.status} />
      <h4 className="m-0 min-w-0 flex-1 text-[13px] font-semibold leading-5 wrap-anywhere">
        {summary.title}
      </h4>
      <ChangesButton changes={props.changes} onClick={props.onShowChanges} />
      <CostNote usage={props.usage} />
      <SessionDetails summary={summary} usage={props.usage} onArchive={props.onArchive} />
    </header>
  );
}
