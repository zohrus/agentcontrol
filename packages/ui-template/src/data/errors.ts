import { ApiError } from "@agentcontrol/sdk";
import { z } from "zod";

const messages: Record<string, string> = {
  "session-not-found": "That session no longer exists.",
  "stale-file": "That file changed while you were editing it.",
  "uncommitted-changes": "The session has changes that are not saved in git.",
  "setup-failed": "Preparing the session's working copy failed.",
  "invalid-request": "AgentControl could not use what was entered.",
  "relay-unavailable":
    "AgentControl is not connected to the agent service right now. It keeps trying.",
  "internal-error": "Something went wrong inside AgentControl.",
  "workspace-exists": "That host is already a workspace.",
  "workspace-removed": "That workspace was removed, so its sessions can only be read.",
  "config-plan-stale":
    "A file changed after you reviewed it, so nothing was written. Review the changes again.",
};
/** Codes whose own message tells the user something they can act on. */
const withDetail = new Set([
  "setup-failed",
  "invalid-request",
  "internal-error",
  "modify-busy",
  "no-update",
  "nothing-to-keep",
  "nothing-to-undo",
  "nothing-to-discard",
]);

const Down = z.object({ workspaceId: z.string() });

/** A request to a machine other than this Mac that is not connected: the app says which and why. */
function isRemoteDown(error: ApiError): boolean {
  const down = Down.safeParse(error.data);
  return error.code === "relay-unavailable" && down.success && down.data.workspaceId !== "local";
}

function describeOther(error: unknown): string {
  return error instanceof TypeError
    ? "AgentControl cannot be reached right now. It keeps trying to reconnect."
    : "Something went wrong in the page. Try again, or reload it.";
}

/** A failure in plain words for a toast or an inline message. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return describeOther(error);
  if (isRemoteDown(error)) return error.message;
  const base = messages[error.code] ?? "Something went wrong.";
  return withDetail.has(error.code) ? `${base} ${error.message}` : base;
}

const Blocked = z.object({ uncommittedFiles: z.array(z.string()) });

/** The files that stopped an archive, when that is what the error says. */
export function uncommittedFilesOf(error: unknown): readonly string[] | undefined {
  if (!(error instanceof ApiError) || error.code !== "uncommitted-changes") return undefined;
  const parsed = Blocked.safeParse(error.data);
  return parsed.success ? parsed.data.uncommittedFiles : [];
}
