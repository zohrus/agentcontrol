import { useEffect } from "react";

const hasOtherKeys = (event: KeyboardEvent): boolean =>
  event.shiftKey || event.altKey || event.repeat;

/** ⌘. on a Mac, Ctrl+. elsewhere; no other modifier, and not while the keys are held down. */
function isModifyShortcut(event: KeyboardEvent): boolean {
  const command = event.metaKey || event.ctrlKey;
  return command && event.key === "." && !hasOtherKeys(event);
}

/** Calls `toggle` when the user presses ⌘. (Ctrl+. off a Mac). */
export function useModifyShortcut(toggle: () => void): void {
  useEffect(() => {
    const listen = (event: KeyboardEvent): void => {
      if (!isModifyShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", listen);
    return () => {
      window.removeEventListener("keydown", listen);
    };
  }, [toggle]);
}
