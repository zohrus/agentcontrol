import type { WorkspaceInfo } from "@agentcontrol/sdk";
import { useEffect, useState } from "react";
import {
  LOCAL_WORKSPACE,
  type SessionRef,
  useChoices,
  useController,
  useWorkspaces,
} from "../data/index.ts";
import { ConnectedModifyDialog } from "../modify/index.ts";
import { NewSessionDialog, type WorkspaceChoice } from "../new-session/index.ts";
import { canTakeCommands } from "../workspaces/index.ts";
import { ConfigDialog } from "./config-dialog.tsx";
import { WorkspacesDialogs } from "./workspaces-dialogs.tsx";

/** What the top bar opens: dialogs, and "analytics", which is a full screen (see `analytics/`). */
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

/** The workspace a session will start on; it falls back to this Mac when that one is removed. */
function useChosenWorkspace(workspaces: readonly WorkspaceInfo[]) {
  const [workspaceId, setWorkspaceId] = useState(LOCAL_WORKSPACE);
  const removed = workspaces.find((workspace) => workspace.id === workspaceId)?.state === "removed";
  useEffect(() => {
    if (removed) setWorkspaceId(LOCAL_WORKSPACE);
  }, [removed]);
  return [workspaceId, setWorkspaceId] as const;
}

type Started = { onStarted: (ref: SessionRef) => void; onStartFailed: (ref: SessionRef) => void };

function NewSession({ onStarted, onStartFailed, ...shared }: Shared & Started) {
  const controller = useController();
  const every = useWorkspaces();
  const [workspaceId, setWorkspaceId] = useChosenWorkspace(every);
  const workspaces = every.filter((workspace) => workspace.state !== "removed");
  const choices = useChoices(workspaceId);
  useEffect(() => {
    if (shared.open) void controller.workspaces.loadChoices(workspaceId);
  }, [controller, shared.open, workspaceId]);
  return (
    <NewSessionDialog
      {...shared}
      workspaces={workspaces.map(choiceOf)}
      workspaceId={workspaceId}
      onWorkspaceChange={setWorkspaceId}
      repos={choices.repos}
      agents={choices.agents}
      onStart={(request) => {
        // The session is listed and can be opened now; the app is asked in the background.
        const started = controller.startSession(request);
        onStarted(started.ref);
        void started.confirmed.then((taken) => {
          if (!taken) onStartFailed(started.ref);
        });
      }}
      onAddRepository={(path) => controller.addRepository(path, workspaceId)}
    />
  );
}

type Props = Started & {
  open: DialogName | undefined;
  onOpenChange: (name: DialogName | undefined) => void;
};

/** Every dialog the top bar can open, each shown when `open` names it. */
export function AppDialogs({ open, onOpenChange, ...started }: Props) {
  const shared = (name: DialogName): Shared => ({
    open: open === name,
    onOpenChange: (isOpen) => {
      onOpenChange(isOpen ? name : undefined);
    },
  });
  return (
    <>
      <NewSession {...shared("new-session")} {...started} />
      <WorkspacesDialogs menu={shared("workspaces")} add={shared("add-workspace")} />
      <ConfigDialog {...shared("config")} />
      <ConnectedModifyDialog {...shared("modify")} />
    </>
  );
}
