import type {
  AnalyticsSessionSort,
  AnalyticsSummary,
  Insight,
  SessionAnalytics,
} from "@agentcontrol/sdk";
import { useEffect, useState } from "react";
import { describeError, useController } from "../data/index.ts";
import { type Preset, rangeOf, tzOffsetOf } from "./date-range.ts";

/** What the user chose to look at. */
export type AnalyticsChoice = {
  preset: Preset;
  workspace: string;
  agent: string;
  repo: string;
  sort: AnalyticsSessionSort;
  order: "asc" | "desc";
};

export type AnalyticsData = {
  summary: AnalyticsSummary;
  sessions: SessionAnalytics[];
  insights: Insight[];
};

export type AnalyticsLoad =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; data: AnalyticsData };

/** The filters the SDK takes, leaving out what the user left on "all". */
function filterOf(choice: AnalyticsChoice) {
  const now = new Date();
  const picked = { workspace: choice.workspace, agent: choice.agent, repo: choice.repo };
  const set = Object.entries(picked).filter(([, value]) => value !== "");
  return { ...rangeOf(choice.preset, now), ...Object.fromEntries(set), tzOffset: tzOffsetOf(now) };
}

/** Loads the summary, the session table and the insights again whenever the choice changes. */
export function useAnalytics(choice: AnalyticsChoice): AnalyticsLoad {
  const { analytics } = useController();
  const [load, setLoad] = useState<AnalyticsLoad>({ state: "loading" });
  const { preset, workspace, agent, repo, sort, order } = choice;
  useEffect(() => {
    let current = true;
    const filter = filterOf({ preset, workspace, agent, repo, sort, order });
    Promise.all([
      analytics.summary(filter),
      analytics.sessions({ ...filter, sort, order }),
      analytics.insights(filter),
    ]).then(
      ([summary, sessions, insights]) => {
        if (current) setLoad({ state: "ready", data: { summary, sessions, insights } });
      },
      (error: unknown) => {
        if (current) setLoad({ state: "failed", message: describeError(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [analytics, preset, workspace, agent, repo, sort, order]);
  return load;
}
