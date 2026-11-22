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
  prompt: string;
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

function initialTyped({ repos, agents }: Inputs): Typed {
  return {
    repoPath: repos[0]?.path ?? "",
    branch: undefined,
    agent: agents[0] ?? "",
    prompt: "",
  };
}

/** The branch to show: what the user typed, else the chosen repository's default branch. */
function toDraft({ repos }: Inputs, typed: Typed): Draft {
  const repo = repos.find((r) => r.path === typed.repoPath);
  return { ...typed, baseBranch: typed.branch ?? repo?.defaultBranch ?? "" };
}

/** Form state for the new-session dialog; the base branch follows the repo until edited. */
export function useNewSessionDraft(inputs: Inputs): DraftForm {
  const [typed, setTyped] = useState<Typed>(() => initialTyped(inputs));
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
