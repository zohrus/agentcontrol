import { useEffect, useState } from "react";
import {
  useController,
  useChoices,
  useWorkspace,
  useWorkspaceCheck,
  useWorkspaces,
} from "../data/index.ts";
import { type AddStage, AddWorkspaceDialog, WorkspaceMenu } from "../workspaces/index.ts";
import { WorkspaceSetupDialog } from "../workspace-setup/index.ts";

type Shared = { open: boolean; onOpenChange: (open: boolean) => void };

/** The steps of adding a workspace: ask for the host, connect, run the checklist, show the result. */
function useAddWorkspace(open: boolean) {
  const { workspaces } = useController();
  const [stage, setStage] = useState<AddStage>("form");
  const [refusal, setRefusal] = useState<string>();
  const [hosts, setHosts] = useState<readonly string[]>([]);
  const [id, setId] = useState<string>();
  useEffect(() => {
    if (!open) return;
    setStage("form");
    setRefusal(undefined);
    void workspaces.hosts().then(setHosts);
  }, [open, workspaces]);
  const check = async (workspaceId: string) => {
    setStage("checking");
    await workspaces.check(workspaceId);
    setStage("result");
  };
  const submit = async (call: { host: string; label?: string }) => {
    setStage("connecting");
    const outcome = await workspaces.add(call);
    if ("refusal" in outcome) {
      setRefusal(outcome.refusal);
      setStage("form");
      return;
    }
    setId(outcome.workspace.id);
    await check(outcome.workspace.id);
  };
  return { stage, refusal, hosts, id, submit, retry: () => id && check(id) };
}

/** "Add workspace…": the form, the connection, and the checklist with a Retry when a step fails. */
function AddWorkspace(shared: Shared) {
  const flow = useAddWorkspace(shared.open);
  const { steps } = useWorkspaceCheck(flow.id ?? "");
  const added = useWorkspace(flow.id);
  const passed = steps.length > 0 && steps.every((step) => step.status === "ok");
  const connected = added?.state === "connected" && passed;
  return (
    <AddWorkspaceDialog
      {...shared}
      stage={flow.stage}
      hosts={flow.hosts}
      refusal={flow.refusal}
      steps={steps}
      connected={connected}
      onSubmit={(call) => void flow.submit(call)}
      onRetry={() => void flow.retry()}
    />
  );
}

/** Check and repair for one workspace, with its repositories' worktree setup. */
function CheckWorkspace({ id, onClose }: { id: string | undefined; onClose: () => void }) {
  const controller = useController();
  const workspace = useWorkspace(id);
  const check = useWorkspaceCheck(id ?? "");
  const { repos } = useChoices(id ?? "");
  useEffect(() => {
    if (id !== undefined) void controller.workspaces.check(id);
  }, [controller, id]);
  return (
    <WorkspaceSetupDialog
      open={id !== undefined}
      onOpenChange={onClose}
      workspaceLabel={workspace?.label ?? "this machine"}
      steps={check.steps}
      checking={check.running}
      repos={repos}
      onRecheck={() => void (id && controller.workspaces.check(id))}
      onSaveSetup={(repoId, setup) => {
        if (id !== undefined) void controller.saveSetup({ workspaceId: id, repoId, setup });
      }}
    />
  );
}

/** The workspace menu and what its buttons open: Add workspace and Check and repair. */
export function WorkspacesDialogs(props: { menu: Shared; add: Shared }) {
  const controller = useController();
  const workspaces = useWorkspaces().filter((workspace) => workspace.state !== "removed");
  const [checking, setChecking] = useState<string>();
  return (
    <>
      <WorkspaceMenu
        {...props.menu}
        workspaces={workspaces}
        onAdd={() => {
          props.add.onOpenChange(true);
        }}
        onCheck={(id) => {
          props.menu.onOpenChange(false);
          setChecking(id);
        }}
        onRestartRelay={(id) => void controller.workspaces.restartRelay(id)}
        onRemove={(id) => void controller.workspaces.remove(id)}
      />
      <AddWorkspace {...props.add} />
      <CheckWorkspace
        id={checking}
        onClose={() => {
          setChecking(undefined);
        }}
      />
    </>
  );
}
