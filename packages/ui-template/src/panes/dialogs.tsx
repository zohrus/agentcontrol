import type { SessionId } from "@agentcontrol/protocol";
import { useEffect } from "react";
import { Button, Dialog } from "../components/index.ts";
import { useController, useData } from "../data/index.ts";
import { ConnectedModifyDialog } from "../modify/index.ts";
import { NewSessionDialog } from "../new-session/index.ts";
import { WorkspaceSetupDialog } from "../workspace-setup/index.ts";

/** The dialogs the top bar opens. Analytics has no backend yet and only says so. */
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
  const soon = open === "analytics" ? open : undefined;
  return (
    <>
      <NewSession {...shared("new-session")} onStarted={onStarted} />
      <Workspace {...shared("workspace")} />
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
