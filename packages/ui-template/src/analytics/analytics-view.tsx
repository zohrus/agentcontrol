import { useState } from "react";
import { Button } from "../components/index.ts";
import { useData } from "../data/index.ts";
import { AnalyticsBody } from "./analytics-body.tsx";
import { FilterBar } from "./filter-bar.tsx";
import { optionsOf } from "./filter-options.ts";
import { type AnalyticsChoice, type AnalyticsLoad, useAnalytics } from "./use-analytics.ts";

type Props = { onClose: () => void; onOpenSession: (sessionId: string) => void };

const FIRST: AnalyticsChoice = {
  preset: "all",
  workspace: "",
  agent: "",
  repo: "",
  sort: "recent",
  order: "desc",
};

const isFiltered = (choice: AnalyticsChoice): boolean =>
  choice.preset !== "all" || choice.workspace !== "" || choice.agent !== "" || choice.repo !== "";

function Message({ text }: { text: string }) {
  return (
    <p className="m-0 rounded-lg border border-dashed border-line p-6 text-center text-muted">
      {text}
    </p>
  );
}

function Content(props: {
  load: AnalyticsLoad;
  choice: AnalyticsChoice;
  update: Update;
  open: Props["onOpenSession"];
}) {
  const { load, choice, update, open } = props;
  if (load.state === "loading") return <Message text="Loading analytics…" />;
  if (load.state === "failed")
    return <Message text={`Analytics could not be loaded: ${load.message}`} />;
  if (load.data.summary.totals.sessions === 0) {
    const text = isFiltered(choice)
      ? "No sessions match these filters."
      : "No sessions yet. Start one and its cost and behaviour will show up here.";
    return <Message text={text} />;
  }
  const sorting = { sort: choice.sort, order: choice.order };
  return <AnalyticsBody data={load.data} sorting={sorting} onSort={update} onOpen={open} />;
}

type Update = (change: Partial<AnalyticsChoice>) => void;

function Filters({ choice, update }: { choice: AnalyticsChoice; update: Update }) {
  const options = optionsOf(useData((s) => s.sessions));
  const picker = (key: "workspace" | "agent" | "repo") => ({
    value: choice[key],
    onChange: (value: string) => {
      update({ [key]: value });
    },
  });
  return (
    <FilterBar
      preset={choice.preset}
      onPreset={(preset) => {
        update({ preset });
      }}
      workspace={{ ...picker("workspace"), options: options.workspaces }}
      agent={{ ...picker("agent"), options: options.agents }}
      repo={{ ...picker("repo"), options: options.repos }}
    />
  );
}

/** The Analytics screen: filters on top, then numbers, charts, insights and the session table. */
export function AnalyticsView({ onClose, onOpenSession }: Props) {
  const [choice, setChoice] = useState<AnalyticsChoice>(FIRST);
  const load = useAnalytics(choice);
  const update: Update = (change) => {
    setChoice({ ...choice, ...change });
  };
  return (
    <div className="h-full overflow-y-auto" data-testid="analytics-view">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4">
        <header className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-base font-semibold">Analytics</h2>
          <Button onClick={onClose}>Back to sessions</Button>
        </header>
        <Filters choice={choice} update={update} />
        <Content load={load} choice={choice} update={update} open={onOpenSession} />
      </div>
    </div>
  );
}
