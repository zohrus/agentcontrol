import { FileDiff } from "lucide-react";
import { Button } from "../components/index.ts";
import { countOf, type SessionUsage, usageBreakdown, usageCostOrTokens } from "../status/index.ts";

/** How much the session changed: files, and lines added and removed. */
export type ChangeTotals = { files: number; additions: number; deletions: number };

/** Room kept for a number that is not known yet, so the title does not move when it appears. */
const FILES_WIDTH = "min-w-28";
const COST_WIDTH = "min-w-12";

/** "3 files +61 −2": a quiet button that shows the session's changes. */
export function ChangesButton(props: { changes?: ChangeTotals | undefined; onClick: () => void }) {
  const { changes } = props;
  if (changes === undefined) return <span aria-hidden="true" className={FILES_WIDTH} />;
  return (
    <Button
      variant="ghost"
      className={`h-7 justify-end px-2 font-normal tabular-nums ${FILES_WIDTH}`}
      onClick={props.onClick}
    >
      <FileDiff aria-hidden="true" className="size-3.5" />
      {countOf(changes.files, "file")}
      <span className="text-add-fg">+{changes.additions}</span>
      <span className="text-del-fg">−{changes.deletions}</span>
    </Button>
  );
}

/** The cost so far ("$1.84"), with the token breakdown as its tooltip. */
export function CostNote({ usage }: { usage?: SessionUsage | undefined }) {
  if (usage === undefined) return <span aria-hidden="true" className={COST_WIDTH} />;
  return (
    <span
      data-testid="session-cost"
      title={usageBreakdown(usage)}
      className={`text-right text-xs tabular-nums text-muted ${COST_WIDTH}`}
    >
      {usageCostOrTokens(usage)}
    </span>
  );
}
