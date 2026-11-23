import { addRepositoryPage } from "./add-repository-page.ts";
import type { Page } from "./playwright.ts";
import { textOf } from "./read-text.ts";

const dialogOf = (page: Page) => page.getByRole("dialog");

/** What to start a session with, typed into the New session dialog. */
export type NewSession = { repoPath: string; agent: string; prompt: string; baseBranch?: string };

/** Presses Add and waits until the app has the repository: the dialog then selects it and resets the base branch. */
async function addsTheRepository(page: Page): Promise<void> {
  const dialog = dialogOf(page);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByLabel("Repository folder").waitFor({ state: "hidden" });
}

/** The New session dialog, field by field. */
function newSessionForm(page: Page) {
  const dialog = dialogOf(page);
  return {
    opensNewSession: () => page.getByRole("button", { name: "New session", exact: true }).click(),
    choosesToAddARepository: () =>
      dialog
        .getByRole("combobox", { name: /^Repository/ })
        .selectOption({ label: "Add repository…" }),
    typesRepositoryFolder: (folder: string) => dialog.getByLabel("Repository folder").fill(folder),
    addsTheRepository: () => addsTheRepository(page),
    choosesAgent: (agent: string) =>
      dialog.getByRole("combobox", { name: /^Agent/ }).selectOption({ label: agent }),
    typesBaseBranch: (branch: string) => dialog.getByLabel("Base branch").fill(branch),
    typesPrompt: (prompt: string) => dialog.getByLabel("What should the agent do?").fill(prompt),
    startsTheSession: () => dialog.getByRole("button", { name: "Start", exact: true }).click(),
    cancelsTheDialog: () => dialog.getByRole("button", { name: "Cancel", exact: true }).click(),
    /** Visits a field and leaves it again, so the dialog checks it and may complain. */
    leavesField: async (label: string): Promise<void> => {
      const field = dialog.getByLabel(label);
      await field.focus();
      await field.blur();
    },
    leavesRepositoryChoice: async (): Promise<void> => {
      const choice = dialog.getByRole("combobox", { name: /^Repository/ });
      await choice.focus();
      await choice.blur();
    },
    startIsEnabled: () => dialog.getByRole("button", { name: "Start", exact: true }).isEnabled(),
  };
}

/** The dialogs: New session, and the archive warning. */
export function dialogsPage(page: Page) {
  const form = newSessionForm(page);
  return {
    ...addRepositoryPage(page),
    ...form,
    /** Opens New session, adds the repository by its folder, picks the agent and starts. */
    startsSession: async (session: NewSession): Promise<void> => {
      await form.opensNewSession();
      await form.choosesToAddARepository();
      await form.typesRepositoryFolder(session.repoPath);
      await form.addsTheRepository();
      await form.choosesAgent(session.agent);
      await form.typesPrompt(session.prompt);
      if (session.baseBranch !== undefined) await form.typesBaseBranch(session.baseBranch);
      await form.startsTheSession();
    },
    archivesAnyway: () => dialogOf(page).getByRole("button", { name: "Archive anyway" }).click(),
    /** The text of the open dialog, or "" when none is open. */
    dialogText: (): Promise<string> => textOf(dialogOf(page)),
  };
}
