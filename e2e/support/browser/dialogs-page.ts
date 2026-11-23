import { addRepositoryPage, typesRepositoryFolder } from "./add-repository-page.ts";
import type { Page } from "./playwright.ts";

const dialogOf = (page: Page) => page.getByRole("dialog");

/** What to start a session with, typed into the New session dialog. */
export type NewSession = { repoPath: string; agent: string; prompt: string };

/** The dialogs: New session, and the archive warning. */
export function dialogsPage(page: Page) {
  return {
    ...addRepositoryPage(page),
    /** Opens New session, adds the repository by its folder, picks the agent and starts. */
    startsSession: async (session: NewSession): Promise<void> => {
      await typesRepositoryFolder(page, session.repoPath);
      const dialog = dialogOf(page);
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
