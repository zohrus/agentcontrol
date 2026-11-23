import { useState } from "react";
import { rememberModifyOpen, useModifyShortcut, wasModifyOpen } from "../modify/index.ts";
import type { DialogName } from "./dialogs.tsx";

/**
 * Which top-bar dialog is open, and a way to change it. The Modify panel comes back open after
 * the page reloads (a kept change reloads the UI), and ⌘. opens and closes it.
 */
export function useOpenDialog() {
  const [dialog, setDialog] = useState<DialogName | undefined>(() =>
    wasModifyOpen() ? "modify" : undefined,
  );
  const show = (name: DialogName | undefined): void => {
    rememberModifyOpen(name === "modify");
    setDialog(name);
  };
  useModifyShortcut(() => {
    // Another dialog may hold input the user has not saved: leave it alone.
    if (dialog === undefined || dialog === "modify") show(dialog ? undefined : "modify");
  });
  return [dialog, show] as const;
}
