import { useEffect, useState } from "react";
import {
  type Controller,
  useController,
  useSetupSteps,
  useWorkspace,
  useWorkspaceCheck,
} from "../data/index.ts";
import { type AddStage, AddWorkspaceDialog, checklistOf } from "../workspaces/index.ts";

type Shared = { open: boolean; onOpenChange: (open: boolean) => void };

/** Where adding a workspace stands; `requestId` names its steps on the live stream. */
type Flow = {
  stage: AddStage;
  refusal: string | undefined;
  id: string | undefined;
  requestId: string | undefined;
  /** True once the checklist ran, so its result replaces the steps announced while connecting. */
  checked: boolean;
};

const FRESH: Flow = {
  stage: "form",
  refusal: undefined,
  id: undefined,
  requestId: undefined,
  checked: false,
};

type Workspaces = Controller["workspaces"];

async function checkIn(call: {
  workspaces: Workspaces;
  update: (patch: Partial<Flow>) => void;
  id: string;
  requestId: string;
}): Promise<void> {
  call.update({ stage: "checking" });
  await call.workspaces.check(call.id, call.requestId);
  call.update({ stage: "result", checked: true });
}

async function addIn(call: {
  workspaces: Workspaces;
  update: (patch: Partial<Flow>) => void;
  host: { host: string; label?: string };
}): Promise<void> {
  const { workspaces, update } = call;
  const requestId = crypto.randomUUID();
  update({ stage: "connecting", requestId, checked: false });
  const outcome = await workspaces.add({ ...call.host, requestId });
  if ("refusal" in outcome) {
    update({ stage: "form", refusal: outcome.refusal });
    return;
  }
  const { id, state } = outcome.workspace;
  update({ id });
  // A host that could not be reached has said which step failed: the checklist would only repeat it.
  if (state === "connected") await checkIn({ workspaces, update, id, requestId });
  else update({ stage: "result" });
}

/** The steps of adding a workspace: ask for the host, connect, run the checklist, show the result. */
function useAddWorkspace(open: boolean) {
  const { workspaces } = useController();
  const [flow, setFlow] = useState<Flow>(FRESH);
  const [hosts, setHosts] = useState<readonly string[]>([]);
  const update = (patch: Partial<Flow>): void => {
    setFlow((now) => ({ ...now, ...patch }));
  };
  useEffect(() => {
    if (!open) return;
    setFlow(FRESH);
    void workspaces.hosts().then(setHosts);
  }, [open, workspaces]);
  const { id, requestId } = flow;
  const retry = () => {
    if (id !== undefined && requestId !== undefined)
      void checkIn({ workspaces, update, id, requestId });
  };
  return {
    flow,
    hosts,
    submit: (host: { host: string; label?: string }) => void addIn({ workspaces, update, host }),
    retry,
  };
}

const allPassed = (steps: ReturnType<typeof checklistOf>): boolean =>
  steps.length > 0 && steps.every((step) => step.status === "ok");

/** What the dialog shows of the setup: the live steps, then the checklist once it has run. */
function useAddResult(flow: Flow) {
  const checkResult = useWorkspaceCheck(flow.id ?? "");
  const progress = useSetupSteps(flow.requestId);
  const steps = flow.checked ? checkResult.steps : checklistOf(progress);
  const connectedNow = useWorkspace(flow.id)?.state === "connected";
  return { progress, steps, connected: connectedNow && allPassed([...steps]) };
}

/** "Add workspace…": the form, the connection, and the checklist with a Retry when a step fails. */
export function AddWorkspace(shared: Shared) {
  const { flow, hosts, submit, retry } = useAddWorkspace(shared.open);
  const result = useAddResult(flow);
  return (
    <AddWorkspaceDialog
      {...shared}
      stage={flow.stage}
      hosts={hosts}
      refusal={flow.refusal}
      {...result}
      onSubmit={submit}
      onRetry={retry}
    />
  );
}
