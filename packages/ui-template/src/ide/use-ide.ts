import type { SessionId } from "@agentcontrol/sdk";
import { useCallback, useEffect, useState } from "react";
import { describeError, useController } from "../data/index.ts";

/** Whether the session's browser VS Code can be opened, in the words the button shows. */
export type IdeState =
  | { state: "checking" }
  | { state: "ready" }
  | { state: "unavailable"; reason: string }
  | { state: "opening" }
  | { state: "failed"; message: string };

const BLOCKED = "The browser did not allow a new tab. Allow pop-ups for this page and try again.";

/** Opens an empty tab at once (a click is needed for that), cut off from this page, to fill in later. */
function emptyTab(): Window | null {
  const tab = window.open("about:blank", "_blank");
  // The page that opens in it is third-party code: it must not be able to steer this page.
  if (tab) tab.opener = null;
  return tab;
}

/**
 * Asks the app whether the session's browser VS Code can be opened: when the session or its
 * workspace changes state, and when this page is looked at again (code-server may have been
 * installed in the meantime).
 */
function useAvailability(call: { id: SessionId; readOnly: boolean }) {
  const controller = useController();
  const [state, setState] = useState<IdeState>({ state: "checking" });
  const { id, readOnly } = call;
  const check = useCallback(() => {
    controller.ideStatus(id).then(
      (answer) => {
        setState(
          answer.available ? { state: "ready" } : { state: "unavailable", reason: answer.reason },
        );
      },
      (error: unknown) => {
        setState({ state: "unavailable", reason: describeError(error) });
      },
    );
  }, [controller, id]);
  useEffect(() => {
    check();
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("focus", check);
    };
  }, [check, readOnly]);
  return [state, setState] as const;
}

/** The state of a session's browser VS Code, and how to open it in a new tab. */
export function useIde(call: { id: SessionId; readOnly: boolean }) {
  const controller = useController();
  const [state, setState] = useAvailability(call);
  const { id } = call;
  const open = useCallback(() => {
    const tab = emptyTab();
    if (tab === null) {
      setState({ state: "failed", message: BLOCKED });
      return;
    }
    setState({ state: "opening" });
    controller.openIde(id).then(
      (url) => {
        tab.location.href = url;
        setState({ state: "ready" });
      },
      (error: unknown) => {
        tab.close();
        setState({ state: "failed", message: describeError(error) });
      },
    );
  }, [controller, id, setState]);
  return { state, open };
}
