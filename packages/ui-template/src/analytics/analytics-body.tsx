import { DayChart } from "./charts/day-chart.tsx";
import { ModelChart } from "./charts/model-chart.tsx";
import { TimeChart } from "./charts/time-chart.tsx";
import { Headline } from "./headline.tsx";
import { InsightsPanel } from "./insights-panel.tsx";
import { SessionsTable, type Sorting } from "./sessions-table.tsx";
import type { AnalyticsData } from "./use-analytics.ts";

type Props = {
  data: AnalyticsData;
  sorting: Sorting;
  onSort: (sorting: Sorting) => void;
  onOpen: (sessionId: string) => void;
};

/** The numbers, the three charts, the insights and the session table. */
export function AnalyticsBody({ data, sorting, onSort, onOpen }: Props) {
  const { summary, sessions, insights } = data;
  return (
    <div className="flex flex-col gap-3">
      <Headline totals={summary.totals} />
      <InsightsPanel insights={insights} sessions={sessions} onOpen={onOpen} />
      <div className="grid gap-3 lg:grid-cols-2">
        <DayChart days={summary.byDay} />
        <div className="flex flex-col gap-3">
          <ModelChart models={summary.byModel} />
          <TimeChart workingMs={summary.totals.workingMs} waitingMs={summary.totals.waitingMs} />
        </div>
      </div>
      <SessionsTable rows={sessions} sorting={sorting} onSort={onSort} onOpen={onOpen} />
    </div>
  );
}
