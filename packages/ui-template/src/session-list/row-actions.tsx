import type { PermissionOption } from "@agentcontrol/protocol";
import { Button } from "../components/index.ts";
import type { PendingPermission } from "./types.ts";

function optionOf(options: readonly PermissionOption[], kinds: readonly string[]) {
  return kinds.flatMap((kind) => options.filter((o) => o.kind === kind))[0];
}

type Props = {
  permission: PendingPermission;
  onAnswer: (requestId: string, optionId: string) => void;
};

type ChoiceProps = {
  /** The option this button answers with; none when the agent offered no such option. */
  option: PermissionOption | undefined;
  label: "Approve" | "Deny";
  permission: PendingPermission;
  onAnswer: Props["onAnswer"];
};

/** One of the two buttons: locked as soon as an answer is on its way, so it is sent once. */
function Choice({ option, label, permission, onAnswer }: ChoiceProps) {
  if (!option) return null;
  return (
    <Button
      variant={label === "Approve" ? "primary" : "default"}
      aria-label={`${label}: ${permission.title}`}
      disabled={permission.answering !== undefined}
      onClick={() => {
        onAnswer(permission.requestId, option.optionId);
      }}
    >
      {label}
    </Button>
  );
}

/** Approve and Deny for the row's single pending permission request. */
export function RowActions({ permission, onAnswer }: Props) {
  const approve = optionOf(permission.options, ["allow_once", "allow_always"]);
  const deny = optionOf(permission.options, ["reject_once", "reject_always"]);
  return (
    <div className="flex items-center gap-1.5 pl-3.5 pt-0.5">
      <Choice option={approve} label="Approve" permission={permission} onAnswer={onAnswer} />
      <Choice option={deny} label="Deny" permission={permission} onAnswer={onAnswer} />
      {permission.answering !== undefined && (
        <span className="text-[11px] text-muted">Sending…</span>
      )}
    </div>
  );
}
