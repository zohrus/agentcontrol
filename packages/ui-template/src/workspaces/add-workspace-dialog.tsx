import type { CheckStep } from "@agentcontrol/sdk";
import { Loader } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Button, Dialog, Field, inputClass } from "../components/index.ts";
import { CheckList } from "../workspace-setup/index.ts";
import { checklistOf, runningStepOf, type SetupStep } from "./setup-steps.ts";

/** Where adding a workspace is: asking for the host, connecting, running the checklist, or done. */
export type AddStage = "form" | "connecting" | "checking" | "result";

export type AddWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: AddStage;
  /** Host aliases from the user's ssh config. */
  hosts: readonly string[];
  /** Why the host was refused, shown under the form. */
  refusal: string | undefined;
  /** The steps of the setup as they happen, while it connects and checks. */
  progress: readonly SetupStep[];
  /** The checklist of the workspace being added. */
  steps: readonly CheckStep[];
  /** True when the workspace is added and every step passed. */
  connected: boolean;
  onSubmit: (call: { host: string; label?: string }) => void;
  onRetry: () => void;
};

const plannedSteps = ["Connect", "Inspect the machine", "Install the relay", "Find agents"];

type TextProps = { label: string; hint: string; value: string; onChange: (v: string) => void };

function TextField({ label, hint, value, onChange, list }: TextProps & { list?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input
        className={inputClass}
        value={value}
        {...(list && { list })}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </Field>
  );
}

function Hosts({ hosts }: { hosts: readonly string[] }) {
  return (
    <datalist id="ssh-hosts">
      {hosts.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}

function Refusal({ text }: { text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <p role="alert" className="m-0 text-xs text-fail">
      {text}
    </p>
  );
}

function HostForm(props: Pick<AddWorkspaceDialogProps, "hosts" | "refusal" | "onSubmit">) {
  const [host, setHost] = useState("");
  const [label, setLabel] = useState("");
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    props.onSubmit(label.trim() === "" ? { host: host.trim() } : { host: host.trim(), label });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <TextField
        label="Host"
        hint="A name from your ~/.ssh/config, or user@host."
        value={host}
        onChange={setHost}
        list="ssh-hosts"
      />
      <Hosts hosts={props.hosts} />
      <TextField
        label="Name (optional)"
        hint="How the workspace is called here. Defaults to the host."
        value={label}
        onChange={setLabel}
      />
      <Refusal text={props.refusal} />
      <Button type="submit" variant="primary" className="self-end" disabled={host.trim() === ""}>
        Add workspace
      </Button>
    </form>
  );
}

function Working(props: { text: string; progress: readonly SetupStep[] }) {
  return (
    <div role="status" className="flex flex-col gap-3 p-4">
      <span className="flex items-center gap-2 font-medium">
        <Loader className="size-4 animate-spin text-run" /> {props.text}
      </span>
      {props.progress.length === 0 ? (
        <span className="text-xs text-muted">Steps: {plannedSteps.join(", ")}, repositories.</span>
      ) : (
        <CheckList
          steps={checklistOf(props.progress)}
          runningStepId={runningStepOf(props.progress)}
        />
      )}
    </div>
  );
}

function failureOf(steps: readonly CheckStep[]): string | undefined {
  const failed = steps.find((step) => step.status === "failed");
  return failed && `${failed.label} failed. ${failed.detail ?? ""}`.trim();
}

function Outcome(props: Pick<AddWorkspaceDialogProps, "steps" | "connected" | "onRetry">) {
  if (props.connected)
    return <p className="m-0 font-medium text-done">The workspace is connected.</p>;
  return (
    <>
      <p role="alert" className="m-0 text-xs text-fail">
        {failureOf(props.steps) ?? "The workspace is not connected yet."}
      </p>
      <Button className="self-start" onClick={props.onRetry}>
        Retry
      </Button>
    </>
  );
}

function Result(props: Pick<AddWorkspaceDialogProps, "steps" | "connected" | "onRetry">) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4">
      <CheckList steps={props.steps} runningStepId={undefined} />
      <Outcome {...props} />
    </div>
  );
}

function Body(props: AddWorkspaceDialogProps) {
  if (props.stage === "form") return <HostForm {...props} />;
  if (props.stage === "connecting") {
    return <Working text="Connecting and installing the relay…" progress={props.progress} />;
  }
  if (props.stage === "checking") {
    return <Working text="Checking the machine…" progress={props.progress} />;
  }
  return <Result {...props} />;
}

/** "Add workspace": pick or type an ssh host, then watch the setup checklist finish. */
export function AddWorkspaceDialog(props: AddWorkspaceDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Add workspace"
      description="Run agents on another machine over ssh. AgentControl installs its relay there."
    >
      <Body {...props} />
    </Dialog>
  );
}
