import type { Page } from "./playwright.ts";

const dialogOf = (page: Page) => page.getByRole("dialog");

/** The "Workspace setup" dialog that Config opens: the checklist and the worktree setup per repo. */
export function workspacePage(page: Page) {
  const dialog = dialogOf(page);
  return {
    opensWorkspaceSetup: () => page.getByRole("button", { name: "Config", exact: true }).click(),
    checksAndRepairs: () => dialog.getByRole("button", { name: "Check and repair" }).click(),
    /** What the dialog says about one checklist step: its state ("Passed") and its text. */
    checklistStep: async (label: string): Promise<{ state: string; text: string } | undefined> => {
      const step = dialog
        .getByRole("listitem")
        .filter({ has: page.getByText(label, { exact: true }) });
      if ((await step.count()) === 0) return undefined;
      const state = (await step.getByRole("img").getAttribute("aria-label")) ?? "";
      return { state, text: await step.innerText() };
    },
    /** The one-line summary above the checklist ("Everything is set up."). */
    checklistSummary: () => dialog.locator("span.flex-1").innerText(),
    addsFilePattern: () => dialog.getByRole("button", { name: "Add file pattern" }).click(),
    typesFilePattern: (number: number, pattern: string) =>
      dialog.getByLabel(`File pattern ${String(number)}`).fill(pattern),
    removesFilePattern: (pattern: string) =>
      dialog.getByRole("button", { name: `Remove ${pattern}`, exact: true }).click(),
    typesSetupScript: (script: string) => dialog.getByLabel("Setup script").fill(script),
    savesTheSetup: () => dialog.getByRole("button", { name: "Save setup" }).click(),
    /** Whether Save setup can be pressed: only when something was changed. */
    saveSetupIsEnabled: () => dialog.getByRole("button", { name: "Save setup" }).isEnabled(),
  };
}
