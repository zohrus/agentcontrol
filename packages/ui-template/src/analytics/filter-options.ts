import type { SessionRow } from "@agentcontrol/sdk";
import { workspaceLabel } from "../data/index.ts";
import type { Option } from "./filter-bar.tsx";

export type FilterOptions = { workspaces: Option[]; agents: Option[]; repos: Option[] };

const lastSegment = (path: string): string => path.split("/").filter(Boolean).at(-1) ?? path;

function unique(pairs: [string, string][]): Option[] {
  const seen = new Map(pairs);
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
}

/** The workspaces, agents and repositories of the sessions the app knows, to pick a filter from. */
export function optionsOf(sessions: readonly SessionRow[]): FilterOptions {
  return {
    workspaces: unique(sessions.map((s) => [s.workspaceId, workspaceLabel(s.workspaceId)])),
    agents: unique(sessions.map((s) => [s.agent, s.agent])),
    repos: unique(sessions.map((s) => [s.repoPath, lastSegment(s.repoPath)])),
  };
}
