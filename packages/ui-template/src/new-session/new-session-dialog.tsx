import type { SyntheticEvent } from "react";
import { Button, Dialog } from "../components/index.ts";
import { RepoPicker } from "./repo-picker.tsx";
import { WorkspaceField } from "./workspace-field.tsx";
import { AgentField, BranchField } from "./text-fields.tsx";
import type { NewSessionDialogProps } from "./types.ts";
import { useNewSessionDraft } from "./use-draft.ts";

type FormProps = Omit<NewSessionDialogProps, "open">;

function Footer({ valid, onCancel }: { valid: boolean; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
      {!valid && (
        <span className="mr-auto text-[11px] text-muted">
          Choose a repository and an agent to create the session.
        </span>
      )}
      <Button type="button" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="primary" disabled={!valid}>
        Create session
      </Button>
    </div>
  );
}

const trunkOf = (repos: FormProps["repos"], repoPath: string): string =>
  repos.find((repo) => repo.path === repoPath)?.defaultBranch ?? "trunk";

/** The base branch to send, or nothing when the user named none. */
const branchOf = (typed: string): { baseBranch?: string } =>
  typed.trim() === "" ? {} : { baseBranch: typed.trim() };

function NewSessionForm(props: FormProps) {
  const { repos, agents, workspaceId, onStart, onAddRepository, onOpenChange } = props;
  const form = useNewSessionDraft({ repos, agents });
  const { agent, repoPath, baseBranch } = form.draft;
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!form.valid || agent === "") return;
    onStart({ workspaceId, agent, repoPath, ...branchOf(baseBranch) });
    onOpenChange(false);
  };
  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <RepoPicker repos={repos} form={form} onAdd={onAddRepository} />
      <BranchField form={form} trunk={trunkOf(repos, repoPath)} />
      <AgentField form={form} agents={agents} />
      <Footer
        valid={form.valid}
        onCancel={() => {
          onOpenChange(false);
        }}
      />
    </form>
  );
}

/** "New session": pick repository and agent and create it; the prompt is written in the session. */
export function NewSessionDialog({ open, ...form }: NewSessionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={form.onOpenChange}
      title="New session"
      description="The agent works in its own copy of the repository, so your files stay untouched."
    >
      <WorkspaceField
        workspaces={form.workspaces}
        value={form.workspaceId}
        onChange={form.onWorkspaceChange}
      />
      <NewSessionForm key={form.workspaceId} {...form} />
    </Dialog>
  );
}
