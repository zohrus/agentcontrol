import { useState } from "react";
import { ArchiveDialog } from "./archive/index.ts";
import {
  exampleAgents,
  exampleCheckSteps,
  exampleModifyEvents,
  exampleRepos,
  exampleUpdateAvailable,
  exampleUpdateMerged,
  exampleVersions,
} from "./dev-fixtures/index.ts";
import { ModifyDialog, type UiUpdate } from "./modify/index.ts";
import { NewSessionDialog } from "./new-session/index.ts";
import { WorkspaceSetupDialog } from "./workspace-setup/index.ts";

/** The dialogs the dev app can open from its buttons. */
export type DialogName = "new-session" | "workspace" | "modify" | "archive";

type Shared = { open: boolean; onOpenChange: (open: boolean) => void };

const noop = () => undefined;
const uncommitted = ["src/middleware/rateLimit.ts", "test/rateLimit.test.ts", ".env.local"];

function WorkspaceDemo(shared: Shared) {
  const [checking, setChecking] = useState(false);
  const recheck = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
    }, 1800);
  };
  return (
    <WorkspaceSetupDialog
      {...shared}
      steps={exampleCheckSteps}
      checking={checking}
      runningStepId={checking ? "claude" : undefined}
      repos={exampleRepos}
      onRecheck={recheck}
      onSaveSetup={noop}
    />
  );
}

function ModifyDemo(shared: Shared) {
  const [update, setUpdate] = useState<UiUpdate | undefined>(exampleUpdateAvailable);
  return (
    <ModifyDialog
      {...shared}
      events={exampleModifyEvents}
      gate="ready"
      versions={exampleVersions}
      update={update}
      onSendPrompt={noop}
      onKeep={() => {
        setUpdate(undefined);
      }}
      onUndo={() => {
        setUpdate(undefined);
      }}
      onRestore={noop}
      onUpdate={() => {
        setUpdate(exampleUpdateMerged);
      }}
    />
  );
}

type Props = { open: DialogName | undefined; onOpenChange: (name: DialogName | undefined) => void };

/** Every dialog of the dev app, each shown when `open` names it. */
export function DevDialogs({ open, onOpenChange }: Props) {
  const shared = (name: DialogName): Shared => ({
    open: open === name,
    onOpenChange: (isOpen) => {
      onOpenChange(isOpen ? name : undefined);
    },
  });
  return (
    <>
      <NewSessionDialog
        {...shared("new-session")}
        repos={exampleRepos}
        agents={exampleAgents}
        onStart={noop}
        onAddRepository={noop}
      />
      <WorkspaceDemo {...shared("workspace")} />
      <ModifyDemo {...shared("modify")} />
      <ArchiveDialog
        {...shared("archive")}
        sessionTitle="Rate limit API"
        uncommittedFiles={uncommitted}
        onArchive={noop}
      />
    </>
  );
}
