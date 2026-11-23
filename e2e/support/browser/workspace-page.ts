import type { Page } from "./playwright.ts";

const dialogOf = (page: Page) => page.getByRole("dialog");

/** The worktree setup of a repository in the dialog: files to copy, setup script, Save. */
function repoSetupEditor(page: Page) {
  const dialog = dialogOf(page);
  return {
    /** Removes one pattern from the files to copy and adds another in its place. */
    swapsFileToCopy: async (swap: { remove: string; add: string }): Promise<void> => {
      await dialog.getByRole("button", { name: `Remove ${swap.remove}`, exact: true }).click();
      await dialog.getByRole("button", { name: "Add file pattern" }).click();
      await dialog.getByLabel("File pattern 1").fill(swap.add);
    },
    typesSetupScript: (script: string) => dialog.getByLabel("Setup script").fill(script),
    savesTheSetup: () => dialog.getByRole("button", { name: "Save setup" }).click(),
    /** Whether Save setup can be pressed: only when something was changed. */
    saveSetupIsEnabled: () => dialog.getByRole("button", { name: "Save setup" }).isEnabled(),
  };
}

/** The "Workspace setup" dialog that Config opens: the checklist and the worktree setup per repo. */
export function workspacePage(page: Page) {
  const dialog = dialogOf(page);
  return {
    ...repoSetupEditor(page),
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
  };
}
