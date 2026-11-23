import type { WorkspaceInfo } from "@agentcontrol/protocol";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, ConfirmDialog, Dialog } from "../components/index.ts";
import { type RowAction, WorkspaceRow } from "./workspace-row.tsx";

export type WorkspaceMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every workspace but the removed ones. */
  workspaces: readonly WorkspaceInfo[];
  onAdd: () => void;
  onCheck: (id: string) => void;
  onRestartRelay: (id: string) => void;
  onRemove: (id: string) => void;
};

type Pending = { action: "restart" | "remove"; workspace: WorkspaceInfo };

function ConfirmText({ pending }: { pending: Pending }) {
  const name = pending.workspace.label;
  if (pending.action === "restart") {
    return (
      <p className="m-0">
        Restarting the relay on {name} stops every session that is running there. Their history
        stays, but the agents end.
      </p>
    );
  }
  return (
    <p className="m-0">
      Remove {name}? Its past sessions stay readable under Removed. Nothing is deleted on the
      machine itself.
    </p>
  );
}

type PendingProps = {
  pending: Pending | undefined;
  onConfirm: (pending: Pending) => void;
  onCancel: () => void;
};

function PendingConfirm({ pending, onConfirm, onCancel }: PendingProps) {
  const restart = pending?.action === "restart";
  return (
    <ConfirmDialog
      open={pending !== undefined}
      title={restart ? "Restart the relay?" : "Remove this workspace?"}
      confirmLabel={restart ? "Restart relay" : "Remove workspace"}
      onConfirm={() => {
        if (pending) onConfirm(pending);
      }}
      onCancel={onCancel}
    >
      {pending && <ConfirmText pending={pending} />}
    </ConfirmDialog>
  );
}

/** Rows ask before restarting or removing: the choice waits in `pending` until confirmed. */
function useRowActions(props: WorkspaceMenuProps) {
  const [pending, setPending] = useState<Pending>();
  return {
    pending,
    cancel: () => {
      setPending(undefined);
    },
    act: (workspace: WorkspaceInfo) => (action: RowAction) => {
      if (action === "check") props.onCheck(workspace.id);
      else setPending({ action, workspace });
    },
    confirm: ({ action, workspace }: Pending) => {
      if (action === "restart") props.onRestartRelay(workspace.id);
      else props.onRemove(workspace.id);
      setPending(undefined);
    },
  };
}

/** The machines agents run on: their connection, and Check and repair, Restart relay and Remove. */
export function WorkspaceMenu(props: WorkspaceMenuProps) {
  const rows = useRowActions(props);
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      placement="right"
      title="Workspaces"
      description="The machines your agents run on."
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {props.workspaces.map((workspace) => (
            <WorkspaceRow key={workspace.id} workspace={workspace} onAction={rows.act(workspace)} />
          ))}
        </ul>
        <Button variant="primary" className="self-start" onClick={props.onAdd}>
          <Plus className="size-3.5" /> Add workspace…
        </Button>
      </div>
      <PendingConfirm pending={rows.pending} onConfirm={rows.confirm} onCancel={rows.cancel} />
    </Dialog>
  );
}
