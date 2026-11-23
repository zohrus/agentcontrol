import type { WorkspaceInfo } from "@agentcontrol/protocol";
import { Button, cn } from "../components/index.ts";
import { connectionDetail, connectionName } from "./connection-text.ts";

export type RowAction = "check" | "restart" | "remove";

type Props = { workspace: WorkspaceInfo; onAction: (action: RowAction) => void };

function Actions({ workspace, onAction }: Props) {
  const act = (action: RowAction) => () => {
    onAction(action);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button onClick={act("check")}>Check and repair</Button>
      {workspace.state === "needs-relay-update" && (
        <Button onClick={act("restart")}>Restart relay</Button>
      )}
      {workspace.kind === "ssh" && <Button onClick={act("remove")}>Remove</Button>}
    </div>
  );
}

/** One workspace: its name, how it is connected and why not, and what can be done about it. */
export function WorkspaceRow({ workspace, onAction }: Props) {
  const detail = workspace.state === "connected" ? undefined : connectionDetail(workspace);
  return (
    <li
      aria-label={workspace.label}
      className="flex flex-col gap-1.5 rounded-lg border border-line p-3"
    >
      <div className="flex items-baseline gap-2">
        <b className="font-medium">{workspace.label}</b>
        {workspace.sshHost && (
          <span className="font-mono text-[11px] text-muted">{workspace.sshHost}</span>
        )}
        <span
          className={cn("ml-auto text-xs", detail ? "text-wait" : "text-done")}
          data-testid="connection"
        >
          {connectionName(workspace)}
        </span>
      </div>
      {detail && <p className="m-0 text-xs text-muted">{detail}</p>}
      <Actions workspace={workspace} onAction={onAction} />
    </li>
  );
}
