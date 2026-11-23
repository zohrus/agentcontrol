import type { Insight, SessionAnalytics } from "@agentcontrol/sdk";

type Props = {
  insights: Insight[];
  sessions: SessionAnalytics[];
  onOpen: (sessionId: string) => void;
};

const MOST_LINKS = 5;

function Links({ insight, sessions, onOpen }: Omit<Props, "insights"> & { insight: Insight }) {
  const titleOf = (id: string): string => sessions.find((s) => s.sessionId === id)?.title ?? id;
  return (
    <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[11px]">
      {insight.sessionIds.slice(0, MOST_LINKS).map((id) => (
        <li key={id}>
          <button
            type="button"
            className="max-w-56 truncate text-accent underline-offset-2 hover:underline"
            onClick={() => {
              onOpen(id);
            }}
          >
            {titleOf(id)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** What stands out, in plain sentences, each with links to the sessions that show it. */
export function InsightsPanel({ insights, sessions, onOpen }: Props) {
  return (
    <section
      aria-labelledby="insights-title"
      className="rounded-lg border border-line bg-surface p-3"
    >
      <h3 id="insights-title" className="m-0 mb-2 text-xs font-semibold">
        Insights
      </h3>
      {insights.length === 0 ? (
        <p className="m-0 text-muted">Nothing stands out. Sessions look ordinary.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {insights.map((insight) => (
            <li key={insight.rule} data-testid={`insight-${insight.rule}`}>
              <p className="m-0">{insight.text}</p>
              <Links insight={insight} sessions={sessions} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
