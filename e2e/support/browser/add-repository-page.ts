import type { Page } from "./playwright.ts";

/** Opens New session, chooses "Add repository…", types the folder and presses Add. */
async function typesRepositoryFolder(page: Page, folder: string): Promise<void> {
  await page.getByRole("button", { name: "New session", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: /^Repository/ })
    .selectOption({ label: "Add repository…" });
  await dialog.getByLabel("Repository folder").fill(folder);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
}

/** Adding a repository by its folder, and what the dialog and the notices say about it. */
export function addRepositoryPage(page: Page) {
  return {
    /** Tries to add a repository by its folder, without starting a session. */
    triesToAddRepository: (folder: string): Promise<void> => typesRepositoryFolder(page, folder),
    /** The text of the folder field of the open dialog, or undefined when the field is not shown. */
    repositoryFolderField: async (): Promise<string | undefined> => {
      const field = page.getByRole("dialog").getByLabel("Repository folder");
      return (await field.count()) === 0 ? undefined : field.inputValue();
    },
    /** The text of the notification that reports a failure, or "" when there is none. */
    failureNoticeText: async (): Promise<string> => {
      // By attribute, because an open dialog hides everything behind it from role queries.
      const notice = page.locator('[role="alert"]');
      return (await notice.count()) === 0 ? "" : notice.first().innerText();
    },
  };
}
