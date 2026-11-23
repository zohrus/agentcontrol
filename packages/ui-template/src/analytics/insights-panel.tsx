import type { Insight } from "@agentcontrol/sdk";

type Props = {
  insights: Insight[];
  onOpen: (workspaceId: string, sessionId: string) => void;
};

const MOST_LINKS = 5;

function Links({ insight, onOpen }: Pick<Props, "onOpen"> & { insight: Insight }) {
  return (
    <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[11px]">
      {insight.sessions.slice(0, MOST_LINKS).map((ref) => (
        <li key={`${ref.workspaceId}/${ref.sessionId}`}>
          <button
            type="button"
            className="max-w-56 truncate text-accent underline-offset-2 hover:underline"
            onClick={() => {
              onOpen(ref.workspaceId, ref.sessionId);
            }}
          >
            {ref.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** What stands out, in plain sentences, each with links to the sessions that show it. */
export function InsightsPanel({ insights, onOpen }: Props) {
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
              <Links insight={insight} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
