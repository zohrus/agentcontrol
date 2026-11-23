import type { SessionId } from "@agentcontrol/protocol";
import { useEffect } from "react";
import { useController, useData } from "../data/index.ts";
import { ConnectedModifyDialog } from "../modify/index.ts";
import { NewSessionDialog } from "../new-session/index.ts";
import { WorkspaceSetupDialog } from "../workspace-setup/index.ts";

/** What the top bar opens: dialogs, and "analytics", which is a full screen (see `analytics/`). */
export type DialogName = "new-session" | "workspace" | "analytics" | "modify";

type Shared = { open: boolean; onOpenChange: (open: boolean) => void };

function NewSession({ onStarted, ...shared }: Shared & { onStarted: (id: SessionId) => void }) {
  const controller = useController();
  const repos = useData((s) => s.repos);
  const agents = useData((s) => s.agents);
  return (
    <NewSessionDialog
      {...shared}
      repos={repos}
      agents={agents}
      onStart={(request) => {
        void controller.startSession(request).then((id) => {
          if (id !== undefined) onStarted(id);
        });
      }}
      onAddRepository={(path) => controller.addRepository(path)}
    />
  );
}

function Workspace(shared: Shared) {
  const controller = useController();
  const checks = useData((s) => s.checks);
  const checking = useData((s) => s.checking);
  const repos = useData((s) => s.repos);
  useEffect(() => {
    if (shared.open) void controller.checkWorkspace();
  }, [controller, shared.open]);
  return (
    <WorkspaceSetupDialog
      {...shared}
      steps={checks}
      checking={checking}
      repos={repos}
      onRecheck={() => void controller.checkWorkspace()}
      onSaveSetup={(repoId, setup) => void controller.saveSetup(repoId, setup)}
    />
  );
}

type Props = {
  open: DialogName | undefined;
  onOpenChange: (name: DialogName | undefined) => void;
  onStarted: (id: SessionId) => void;
};

/** Every dialog the top bar can open, each shown when `open` names it. */
export function AppDialogs({ open, onOpenChange, onStarted }: Props) {
  const shared = (name: DialogName): Shared => ({
    open: open === name,
    onOpenChange: (isOpen) => {
      onOpenChange(isOpen ? name : undefined);
    },
  });
  return (
    <>
      <NewSession {...shared("new-session")} onStarted={onStarted} />
      <Workspace {...shared("workspace")} />
      <ConnectedModifyDialog {...shared("modify")} />
    </>
  );
}
