import type { AnalyticsSessionSort, SessionAnalytics } from "@agentcontrol/sdk";
import { formatCostExact, formatElapsed, formatTokens } from "../status/index.ts";

export type Column = {
  sort: AnalyticsSessionSort;
  label: string;
  numeric: boolean;
  text: (row: SessionAnalytics) => string;
};

const cost = (row: SessionAnalytics): string => {
  if (row.costUsd !== undefined) return formatCostExact(row.costUsd);
  return row.noCostReported ? "no cost reported" : "–";
};

/** The session table's columns, in order; `sort` is what clicking the heading orders by. */
export const COLUMNS: readonly Column[] = [
  { sort: "title", label: "Session", numeric: false, text: (row) => row.title },
  { sort: "agent", label: "Agent", numeric: false, text: (row) => row.agent },
  { sort: "model", label: "Model", numeric: false, text: (row) => row.model ?? "–" },
  { sort: "workspace", label: "Workspace", numeric: false, text: (row) => row.workspace },
  { sort: "turns", label: "Turns", numeric: true, text: (row) => String(row.turns) },
  { sort: "tokens", label: "Tokens", numeric: true, text: (row) => formatTokens(row.tokens.total) },
  { sort: "cost", label: "Cost", numeric: true, text: cost },
  { sort: "working", label: "Working", numeric: true, text: (row) => formatElapsed(row.workingMs) },
  { sort: "waiting", label: "Waiting", numeric: true, text: (row) => formatElapsed(row.waitingMs) },
  {
    sort: "lines",
    label: "Changed lines",
    numeric: true,
    text: (row) => `+${String(row.linesAdded)} −${String(row.linesRemoved)}`,
  },
];

/** Text columns start A to Z; number columns start with the biggest. */
export const firstOrderOf = (column: Column): "asc" | "desc" => (column.numeric ? "desc" : "asc");
