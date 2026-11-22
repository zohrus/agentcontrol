import type { Page } from "./playwright.ts";

const dialogOf = (page: Page) => page.getByRole("dialog");

/** What to start a session with, typed into the New session dialog. */
export type NewSession = { repoPath: string; agent: string; prompt: string };

/** The dialogs: New session, and the archive warning. */
export function dialogsPage(page: Page) {
  return {
    /** Opens New session, adds the repository by its folder, picks the agent and starts. */
    startsSession: async (session: NewSession): Promise<void> => {
      await page.getByRole("button", { name: "New session", exact: true }).click();
      const dialog = dialogOf(page);
      await dialog
        .getByRole("combobox", { name: /^Repository/ })
        .selectOption({ label: "Add repository…" });
      await dialog.getByLabel("Repository folder").fill(session.repoPath);
      await dialog.getByRole("button", { name: "Add", exact: true }).click();
      await dialog.getByRole("combobox", { name: /^Agent/ }).selectOption({ label: session.agent });
      await dialog.getByLabel("What should the agent do?").fill(session.prompt);
      await dialog.getByRole("button", { name: "Start", exact: true }).click();
    },
    archivesAnyway: () => dialogOf(page).getByRole("button", { name: "Archive anyway" }).click(),
    /** The text of the open dialog, or "" when none is open. */
    dialogText: async (): Promise<string> =>
      (await dialogOf(page).count()) === 0 ? "" : dialogOf(page).innerText(),
  };
}
