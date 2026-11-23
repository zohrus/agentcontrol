import { type ReactNode, useId, useState } from "react";
import { Button } from "../../components/index.ts";

type TableView = { head: string[]; rows: string[][] };

/** A series' colour and name, shown beside the chart so colour is never the only clue. */
export type LegendEntry = { name: string; colour: string };

function Legend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[11px] text-muted">
      {entries.map((entry) => (
        <li key={entry.name} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: entry.colour }}
          />
          {entry.name}
        </li>
      ))}
    </ul>
  );
}

function HeadRow({ head }: { head: string[] }) {
  return (
    <tr>
      {head.map((cell) => (
        <th
          key={cell}
          scope="col"
          className="border-b border-line py-1 pr-3 font-medium text-muted"
        >
          {cell}
        </th>
      ))}
    </tr>
  );
}

function DataTable({ view, caption }: { view: TableView; caption: string }) {
  return (
    <table className="w-full border-collapse text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <HeadRow head={view.head} />
      </thead>
      <tbody>
        {view.rows.map((row) => (
          <tr key={row.join("|")}>
            {row.map((cell, index) => (
              <td key={`${cell}-${String(index)}`} className="py-1 pr-3 font-mono">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Props = {
  title: string;
  legend?: LegendEntry[];
  table: TableView;
  children: ReactNode;
};

/** A titled chart with its legend and a button that swaps the picture for the same numbers in a table. */
export function ChartCard({ title, legend, table, children }: Props) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-lg border border-line bg-surface p-3">
      <header className="mb-2 flex items-start justify-between gap-2">
        <h3 id={id} className="m-0 text-xs font-semibold">
          {title}
        </h3>
        <Button
          variant="ghost"
          aria-pressed={asTable}
          onClick={() => {
            setAsTable(!asTable);
          }}
        >
          {asTable ? "Show chart" : "Show as table"}
        </Button>
      </header>
      {asTable ? <DataTable view={table} caption={title} /> : children}
      {legend && !asTable ? <Legend entries={legend} /> : null}
    </section>
  );
}
