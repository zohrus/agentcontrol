import type { AgentKind, RepoInfo } from "@agentcontrol/protocol";
import { useState } from "react";
import {
  type Draft,
  type DraftErrors,
  type DraftField,
  onlyTouched,
  validateDraft,
} from "./validate.ts";

type Inputs = { repos: readonly RepoInfo[]; agents: readonly AgentKind[] };
type Typed = {
  repoPath: string;
  branch: string | undefined;
  agent: AgentKind | "";
};

export type DraftForm = {
  draft: Draft;
  /** Errors for fields the user has already touched. */
  shown: DraftErrors;
  /** True when every field is valid. */
  valid: boolean;
  update: (patch: Partial<Typed>) => void;
  touch: (field: DraftField) => void;
};

function initialTyped(): Typed {
  return { repoPath: "", branch: undefined, agent: "" };
}

const firstRepoPath = (repos: Inputs["repos"]): string => repos[0]?.path ?? "";
const firstAgent = (agents: Inputs["agents"]): AgentKind | "" => agents[0] ?? "";

/** What the form shows: what the user typed, else the first repository and agent; no branch. */
function toDraft({ repos, agents }: Inputs, typed: Typed): Draft {
  const repoPath = typed.repoPath || firstRepoPath(repos);
  const agent = typed.agent || firstAgent(agents);
  const baseBranch = typed.branch ?? "";
  return { ...typed, repoPath, agent, baseBranch };
}

/** Form state for the new-session dialog; the base branch stays empty unless the user types one. */
export function useNewSessionDraft(inputs: Inputs): DraftForm {
  const [typed, setTyped] = useState<Typed>(initialTyped);
  const [touched, setTouched] = useState<readonly DraftField[]>([]);
  const draft = toDraft(inputs, typed);
  const errors = validateDraft(draft);
  return {
    draft,
    shown: onlyTouched(errors, touched),
    valid: Object.keys(errors).length === 0,
    update: (patch) => {
      setTyped((current) => ({ ...current, ...patch }));
    },
    touch: (field) => {
      setTouched((current) => (current.includes(field) ? current : [...current, field]));
    },
  };
}
