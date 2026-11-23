import type { WorkspaceInfo } from "@agentcontrol/sdk";
import { useEffect, useState } from "react";
import { Button, Dialog } from "../components/index.ts";
import {
  LOCAL_WORKSPACE,
  type SessionRef,
  useChoices,
  useController,
  useData,
  useWorkspaces,
} from "../data/index.ts";
import { ConnectedModifyDialog } from "../modify/index.ts";
import { NewSessionDialog, type WorkspaceChoice } from "../new-session/index.ts";
import { canTakeCommands } from "../workspaces/index.ts";
import { ConfigDialog } from "./config-dialog.tsx";
import { WorkspacesDialogs } from "./workspaces-dialogs.tsx";

/** The dialogs the top bar opens. Analytics has no backend yet and only says so. */
export type DialogName =
  | "new-session"
  | "workspaces"
  | "add-workspace"
  | "config"
  | "analytics"
  | "modify";

type Shared = { open: boolean; onOpenChange: (open: boolean) => void };

const choiceOf = (w: WorkspaceInfo): WorkspaceChoice => ({
  id: w.id,
  label: w.label,
  connected: canTakeCommands(w),
});

function NewSession({ onStarted, ...shared }: Shared & { onStarted: (ref: SessionRef) => void }) {
  const controller = useController();
  const [workspaceId, setWorkspaceId] = useState(LOCAL_WORKSPACE);
  const choices = useChoices(workspaceId);
  const ready = useData((s) => s.choices[workspaceId] !== undefined);
  const workspaces = useWorkspaces().filter((workspace) => workspace.state !== "removed");
  useEffect(() => {
    if (shared.open) void controller.workspaces.loadChoices(workspaceId);
  }, [controller, shared.open, workspaceId]);
  return (
    <NewSessionDialog
      {...shared}
      workspaces={workspaces.map(choiceOf)}
      workspaceId={workspaceId}
      ready={ready}
      onWorkspaceChange={setWorkspaceId}
      repos={choices.repos}
      agents={choices.agents}
      onStart={(request) => {
        void controller.startSession(request).then((ref) => {
          if (ref !== undefined) onStarted(ref);
        });
      }}
      onAddRepository={(path) => controller.addRepository(path, workspaceId)}
    />
  );
}

const comingSoon: Record<"analytics", string> = {
  analytics:
    "Analytics is not ready yet. It will show what your sessions cost and where time goes.",
};

function ComingSoon({ name, onClose }: { name: "analytics" | undefined; onClose: () => void }) {
  return (
    <Dialog open={name !== undefined} onOpenChange={onClose} title="Coming soon">
      <div className="flex flex-col gap-3 p-4">
        <p className="m-0">{name ? comingSoon[name] : ""}</p>
        <Button className="self-end" onClick={onClose}>
          OK
        </Button>
      </div>
    </Dialog>
  );
}

type Props = {
  open: DialogName | undefined;
  onOpenChange: (name: DialogName | undefined) => void;
  onStarted: (ref: SessionRef) => void;
};

/** Every dialog the top bar can open, each shown when `open` names it. */
export function AppDialogs({ open, onOpenChange, onStarted }: Props) {
  const shared = (name: DialogName): Shared => ({
    open: open === name,
    onOpenChange: (isOpen) => {
      onOpenChange(isOpen ? name : undefined);
    },
  });
  const soon = open === "analytics" ? open : undefined;
  return (
    <>
      <NewSession {...shared("new-session")} onStarted={onStarted} />
      <WorkspacesDialogs menu={shared("workspaces")} add={shared("add-workspace")} />
      <ConfigDialog {...shared("config")} />
      <ConnectedModifyDialog {...shared("modify")} />
      <ComingSoon
        name={soon}
        onClose={() => {
          onOpenChange(undefined);
        }}
      />
    </>
  );
}
