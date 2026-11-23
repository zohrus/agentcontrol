import { useEffect, useState } from "react";
import {
  useController,
  useChoices,
  useWorkspace,
  useWorkspaceCheck,
  useWorkspaces,
} from "../data/index.ts";
import { WorkspaceMenu } from "../workspaces/index.ts";
import { WorkspaceSetupDialog } from "../workspace-setup/index.ts";
import { AddWorkspace } from "./add-workspace.tsx";

type Shared = { open: boolean; onOpenChange: (open: boolean) => void };

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
