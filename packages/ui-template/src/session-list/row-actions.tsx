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

/** Approve and Deny for the row's single pending permission request. */
export function RowActions({ permission, onAnswer }: Props) {
  const approve = optionOf(permission.options, ["allow_once", "allow_always"]);
  const deny = optionOf(permission.options, ["reject_once", "reject_always"]);
  const answer = (optionId: string) => () => {
    onAnswer(permission.requestId, optionId);
  };
  return (
    <div className="flex items-center gap-1.5 pl-3.5 pt-0.5">
      {approve && (
        <Button
          variant="primary"
          aria-label={`Approve: ${permission.title}`}
          onClick={answer(approve.optionId)}
        >
          Approve
        </Button>
      )}
      {deny && (
        <Button aria-label={`Deny: ${permission.title}`} onClick={answer(deny.optionId)}>
          Deny
        </Button>
      )}
    </div>
  );
}
