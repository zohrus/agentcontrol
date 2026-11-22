import { useEffect } from "react";

/** Calls `toggle` when the user presses ⌘. (Ctrl+. off a Mac). */
export function useModifyShortcut(toggle: () => void): void {
  useEffect(() => {
    const listen = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", listen);
    return () => {
      window.removeEventListener("keydown", listen);
    };
  }, [toggle]);
}
