import type { SessionId } from "@agentcontrol/sdk";
import { Button } from "../components/index.ts";
import { type IdeState, useIde } from "./use-ide.ts";

/** The words under the button when it cannot be used (and a hint while it can). */
function noteOf(state: IdeState): string | undefined {
  if (state.state === "unavailable") return state.reason;
  if (state.state === "failed") return state.message;
  if (state.state === "checking")
    return "Checking whether code-server is installed on this workspace.";
  return undefined;
}

const isUsable = (state: IdeState): boolean => state.state === "ready" || state.state === "failed";

/**
 * "Open in browser VS Code": starts code-server on the session's workspace, on its worktree, and
 * shows it in a new tab. Disabled, with the reason as its description, when code-server is not
 * installed there, the workspace is offline or the session was archived.
 */
export function OpenInBrowserVSCode(props: { id: SessionId; readOnly: boolean }) {
  const { state, open } = useIde(props);
  const note = noteOf(state);
  return (
    <Button
      className="mb-1.5 px-2 py-0.5 text-[11px]"
      disabled={!isUsable(state)}
      title={note ?? "Opens VS Code in your browser, on this session's worktree."}
      aria-description={note}
      onClick={open}
    >
      {state.state === "opening" ? "Opening…" : "Open in browser VS Code"}
    </Button>
  );
}
