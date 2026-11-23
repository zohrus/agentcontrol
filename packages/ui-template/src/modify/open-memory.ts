const KEY = "agentcontrol.modify-panel-open";

/**
 * The panel stays open across the reload that follows a promoted change: the browser keeps this
 * flag for the tab. Storage can be blocked, and then the panel simply starts closed.
 */
export function rememberModifyOpen(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage is blocked: nothing to remember.
  }
}

/** True when the panel was open before the page reloaded. */
export function wasModifyOpen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
