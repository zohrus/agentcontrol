import type { AgentKind } from "@agentcontrol/protocol";

/** The "Add repository…" choice in the repository picker. */
export const ADD_REPOSITORY = "__add-repository__";

export type DraftField = "repo" | "branch" | "agent" | "prompt";
export type Draft = { repoPath: string; baseBranch: string; agent: AgentKind | ""; prompt: string };
export type DraftErrors = Partial<Record<DraftField, string>>;

const fields: readonly DraftField[] = ["repo", "branch", "agent", "prompt"];

function repoError({ repoPath }: Draft): string | undefined {
  if (repoPath === "") return "Choose a repository to work in.";
  return repoPath === ADD_REPOSITORY
    ? "Type the folder of the repository and press Add."
    : undefined;
}

function branchError({ baseBranch }: Draft): string | undefined {
  if (baseBranch.trim() === "") return "Enter the branch the work should start from.";
  return /\s/.test(baseBranch.trim()) ? "A branch name cannot contain spaces." : undefined;
}

function agentError({ agent }: Draft): string | undefined {
  return agent === "" ? "Choose which agent should do the work." : undefined;
}

function promptError({ prompt }: Draft): string | undefined {
  return prompt.trim() === "" ? "Tell the agent what to do." : undefined;
}

/** Plain-language problems with the draft, per field; an empty object means it can start. */
export function validateDraft(draft: Draft): DraftErrors {
  const found: Record<DraftField, string | undefined> = {
    repo: repoError(draft),
    branch: branchError(draft),
    agent: agentError(draft),
    prompt: promptError(draft),
  };
  return Object.fromEntries(fields.flatMap((f) => (found[f] ? [[f, found[f]]] : [])));
}

/** Keeps only the errors of fields the user has already touched. */
export function onlyTouched(errors: DraftErrors, touched: readonly DraftField[]): DraftErrors {
  return Object.fromEntries(touched.flatMap((f) => (errors[f] ? [[f, errors[f]]] : [])));
}
