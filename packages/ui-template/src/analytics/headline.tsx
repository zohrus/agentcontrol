import type { AnalyticsTotals } from "@agentcontrol/sdk";
import { formatCostExact, formatElapsed, formatTokens } from "../status/index.ts";

type Tile = { label: string; value: string; note: string };

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

/** Said once, in the cost tile: the normalised usage updates carry no plan or limit information. */
const NO_LIMITS = "Your plan's usage limits are not reported by the agent.";

/** Cost adds only what agents reported; sessions with tokens and no cost are named, never counted as $0. */
function costTile(totals: AnalyticsTotals): Tile {
  const missing = totals.sessionsWithoutCost;
  const note =
    missing > 0
      ? `${plural(missing, "session")} with no cost reported. ${NO_LIMITS}`
      : "as reported by the agents";
  const none = totals.sessionsWithCost === 0 && missing > 0;
  return {
    label: "Cost",
    value: none ? "No cost reported" : formatCostExact(totals.costUsd),
    note,
  };
}

function tokensTile(totals: AnalyticsTotals): Tile {
  const { tokens } = totals;
  return {
    label: "Tokens",
    value: formatTokens(tokens.total),
    note: `${formatTokens(tokens.input)} in · ${formatTokens(tokens.output)} out · ${formatTokens(tokens.cacheRead)} cached`,
  };
}

/** Without any reported cost, tokens are the only measure of use, so they come first. */
function leadingTiles(totals: AnalyticsTotals): Tile[] {
  const sessions = {
    label: "Sessions",
    value: String(totals.sessions),
    note: plural(totals.turns, "turn"),
  };
  const noCost = totals.sessionsWithCost === 0 && totals.sessionsWithoutCost > 0;
  return noCost
    ? [tokensTile(totals), costTile(totals), sessions]
    : [sessions, tokensTile(totals), costTile(totals)];
}

function tilesOf(totals: AnalyticsTotals): Tile[] {
  return [
    ...leadingTiles(totals),
    {
      label: "Working / waiting",
      value: `${formatElapsed(totals.workingMs)} / ${formatElapsed(totals.waitingMs)}`,
      note: "agent worked / waited for you",
    },
    {
      label: "Lines changed",
      value: `+${String(totals.linesAdded)} −${String(totals.linesRemoved)}`,
      note: `${String(totals.permissionsAllowed)} allowed · ${String(totals.permissionsDenied)} denied requests`,
    },
  ];
}

/** The headline numbers above the charts. */
export function Headline({ totals }: { totals: AnalyticsTotals }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-2 md:grid-cols-5">
      {tilesOf(totals).map((tile) => (
        <div key={tile.label} className="rounded-lg border border-line bg-surface p-3">
          <dt className="text-[11px] text-muted">{tile.label}</dt>
          <dd className="m-0 mt-1 text-lg font-semibold" data-testid={`headline-${tile.label}`}>
            {tile.value}
          </dd>
          <dd className="m-0 mt-0.5 text-[11px] text-muted">{tile.note}</dd>
        </div>
      ))}
    </dl>
  );
}
