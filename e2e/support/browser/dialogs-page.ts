import { addRepositoryPage } from "./add-repository-page.ts";
import { messageBoxPage } from "./message-box-page.ts";
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

/** Opens "Advanced" in the New session dialog, unless it is open already. */
async function opensAdvanced(page: Page): Promise<void> {
  const dialog = dialogOf(page);
  if ((await dialog.locator("details").getAttribute("open")) !== null) return;
  await dialog.getByText("Advanced", { exact: true }).click();
}

/** Opens "Advanced" and types the base branch. */
async function typesBranch(page: Page, branch: string): Promise<void> {
  await opensAdvanced(page);
  await dialogOf(page).getByLabel("Base branch").fill(branch);
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
    typesBaseBranch: (branch: string) => typesBranch(page, branch),
    createsTheSession: () =>
      dialog.getByRole("button", { name: "Create session", exact: true }).click(),
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
  };
}

/** Writes the first prompt in the open session's message box and sends it. */
async function sendsFirstPrompt(page: Page, prompt: string): Promise<void> {
  const box = messageBoxPage(page);
  await box.writesInTheMessageBox(prompt);
  await box.pressesSend();
}

/** Opens New session, adds the repository, picks the agent and creates the session. */
async function createsSession(page: Page, session: Omit<NewSession, "prompt">): Promise<void> {
  const form = newSessionForm(page);
  await form.opensNewSession();
  await form.choosesToAddARepository();
  await form.typesRepositoryFolder(session.repoPath);
  await form.addsTheRepository();
  await form.choosesAgent(session.agent);
  if (session.baseBranch !== undefined) await form.typesBaseBranch(session.baseBranch);
  await form.createsTheSession();
}

/** The dialogs: New session, and the archive warning. */
export function dialogsPage(page: Page) {
  return {
    ...addRepositoryPage(page),
    ...newSessionForm(page),
    ...messageBoxPage(page),
    opensTheAdvancedOptions: () => opensAdvanced(page),
    sendsTheFirstPrompt: (prompt: string) => sendsFirstPrompt(page, prompt),
    createsSession: (session: Omit<NewSession, "prompt">) => createsSession(page, session),
    /** Creates the session in the dialog, then writes its first prompt in the session. */
    startsSession: async (session: NewSession): Promise<void> => {
      await createsSession(page, session);
      await sendsFirstPrompt(page, session.prompt);
    },
    archivesAnyway: () => dialogOf(page).getByRole("button", { name: "Archive anyway" }).click(),
    /** The text of the open dialog, or "" when none is open. */
    dialogText: (): Promise<string> => textOf(dialogOf(page)),
  };
}
