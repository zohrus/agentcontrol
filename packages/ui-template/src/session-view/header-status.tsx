import type { SessionStatus } from "@agentcontrol/protocol";
import { dotKind, StatusDot } from "../session-list/index.ts";

/** A spinner while the agent works; otherwise the status dot of the session list. Always the same size. */
export function HeaderStatus({ status }: { status: SessionStatus }) {
  return (
    <span className="flex size-4 flex-none items-center justify-center">
      {dotKind(status) === "run" ? (
        <i
          role="img"
          aria-label={status}
          className="inline-block size-3.5 animate-spin rounded-full border-2 border-run border-t-transparent"
        />
      ) : (
        <StatusDot status={status} />
      )}
    </span>
  );
}
