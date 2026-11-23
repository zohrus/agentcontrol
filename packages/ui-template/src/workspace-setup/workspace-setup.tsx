import type { CheckStep } from "@agentcontrol/protocol";
import { Loader } from "lucide-react";
import { Button, Dialog } from "../components/index.ts";
import { CheckList } from "./check-list.tsx";
import { RepoSetupEditor } from "./repo-setup-editor.tsx";
import type { WorkspaceSetupProps } from "./types.ts";

function summary(steps: readonly CheckStep[]): string {
  const failed = steps.filter((step) => step.status === "failed").length;
  if (failed === 0) return "Everything is set up.";
  return failed === 1 ? "1 thing needs attention." : `${String(failed)} things need attention.`;
}

function CheckHeader({
  steps,
  checking,
  onRecheck,
}: Pick<WorkspaceSetupProps, "steps" | "checking" | "onRecheck">) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-sm font-medium">{checking ? "Checking…" : summary(steps)}</span>
      <Button variant="primary" disabled={checking} onClick={onRecheck}>
        {checking && <Loader className="size-3.5 animate-spin" />}
        Check and repair
      </Button>
    </div>
  );
}

/** The "Add workspace / Check and repair" checklist and per-repository worktree setup. */
export function WorkspaceSetup(props: WorkspaceSetupProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4">
        <CheckHeader steps={props.steps} checking={props.checking} onRecheck={props.onRecheck} />
        <CheckList steps={props.steps} runningStepId={props.runningStepId} />
        <h3 className="m-0 border-t border-line pt-3 text-xs font-medium">Worktree setup</h3>
        {props.repos.map((repo) => (
          <RepoSetupEditor
            key={repo.repoId}
            repo={repo}
            onSave={(setup) => {
              props.onSaveSetup(repo.repoId, setup);
            }}
          />
        ))}
      </div>
    </div>
  );
}

type DialogProps = WorkspaceSetupProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The machine being checked; "this machine" when left out. */
  workspaceLabel?: string;
};

/** The workspace setup as a dialog, opened from "Config". */
export function WorkspaceSetupDialog(props: DialogProps) {
  const { open, onOpenChange, workspaceLabel = "this machine", ...setup } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Workspace setup"
      description={`Check that ${workspaceLabel} is ready to run agents, and repair what is not.`}
    >
      <WorkspaceSetup {...setup} />
    </Dialog>
  );
}
