import type { AnalyticsSessionSort, SessionAnalytics } from "@agentcontrol/sdk";
import { cn } from "../components/index.ts";
import { type Column, COLUMNS, firstOrderOf } from "./table-columns.ts";

export type Sorting = { sort: AnalyticsSessionSort; order: "asc" | "desc" };

type Props = {
  rows: SessionAnalytics[];
  sorting: Sorting;
  onSort: (sorting: Sorting) => void;
  onOpen: (sessionId: string) => void;
};

const ariaSort = (column: Column, sorting: Sorting): "ascending" | "descending" | "none" => {
  if (sorting.sort !== column.sort) return "none";
  return sorting.order === "asc" ? "ascending" : "descending";
};

function nextSorting(column: Column, sorting: Sorting): Sorting {
  if (sorting.sort !== column.sort) return { sort: column.sort, order: firstOrderOf(column) };
  return { sort: column.sort, order: sorting.order === "asc" ? "desc" : "asc" };
}

function Heading(props: { column: Column; sorting: Sorting; onSort: Props["onSort"] }) {
  const { column, sorting, onSort } = props;
  const state = ariaSort(column, sorting);
  const arrow = { ascending: " ▲", descending: " ▼", none: "" }[state];
  return (
    <th
      scope="col"
      aria-sort={state}
      className={cn("p-0 font-medium", column.numeric && "text-right")}
    >
      <button
        type="button"
        className="w-full px-2 py-1.5 text-inherit hover:bg-code"
        style={{ textAlign: column.numeric ? "right" : "left" }}
        onClick={() => {
          onSort(nextSorting(column, sorting));
        }}
      >
        {column.label}
        {arrow}
      </button>
    </th>
  );
}

function Cell(props: { column: Column; row: SessionAnalytics; onOpen: Props["onOpen"] }) {
  const { column, row, onOpen } = props;
  const opens = column.sort === "title";
  return (
    <td className={cn("px-2 py-1.5", column.numeric && "text-right font-mono")}>
      {opens ? (
        <button
          type="button"
          className="max-w-64 truncate text-left text-accent underline-offset-2 hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(row.sessionId);
          }}
        >
          {column.text(row)}
        </button>
      ) : (
        column.text(row)
      )}
    </td>
  );
}

function Row({ row, onOpen }: { row: SessionAnalytics; onOpen: Props["onOpen"] }) {
  return (
    <tr
      className="cursor-pointer border-t border-line hover:bg-code"
      data-testid="analytics-row"
      onClick={() => {
        onOpen(row.sessionId);
      }}
    >
      {COLUMNS.map((column) => (
        <Cell key={column.sort} column={column} row={row} onOpen={onOpen} />
      ))}
    </tr>
  );
}

/** One row per session; the headings sort, a row opens its session. */
export function SessionsTable({ rows, sorting, onSort, onOpen }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          Sessions with their tokens, cost, time and changed lines
        </caption>
        <thead className="text-muted">
          <tr>
            {COLUMNS.map((column) => (
              <Heading key={column.sort} column={column} sorting={sorting} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={`${row.workspaceId}/${row.sessionId}`} row={row} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
