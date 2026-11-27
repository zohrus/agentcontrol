import type { Locator, Page } from "./playwright.ts";
import { textOf } from "./read-text.ts";

const diffOf = (page: Page) => page.locator('[data-testid="diff-viewer"]');
const editorOf = (page: Page) => page.locator('[data-testid="code-editor"]');

/** The text of an element ("" when absent), with Monaco's non-breaking spaces made plain. */
async function plainText(element: Locator): Promise<string> {
  return (await textOf(element)).replaceAll("\u00a0", " ");
}

async function replaceInEditor(page: Page, text: string): Promise<void> {
  await editorOf(page).locator(".view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(text);
}

/** The right-hand panel: the Changes tab with its diff, and the Editor tab. */
export function changesPage(page: Page) {
  return {
    opensChangesTab: () => page.getByRole("tab", { name: /^Changes/ }).click(),
    /** Whether the Changes tab of the right-hand panel is the one that is open. */
    changesTabIsOpen: async (): Promise<boolean> =>
      (await page.getByRole("tab", { name: /^Changes/ }).getAttribute("aria-selected")) === "true",
    opensEditorTab: () => page.getByRole("tab", { name: "Editor" }).click(),
    opensChangedFile: (path: string) =>
      page
        .getByRole("button", {
          name: new RegExp(`^${path.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
        })
        .first()
        .click(),
    opensFileInEditor: (path: string) =>
      page
        .locator('[data-testid="file-tree"]')
        .getByRole("button", { name: path, exact: true })
        .click(),
    ...editing(page),
    filtersFilesBy: (text: string) => page.getByLabel("Filter files").fill(text),
    /** The files the Editor tab offers, as its list shows them. */
    editableFiles: (): Promise<string[]> =>
      page.locator('[data-testid="file-tree"] li > button:first-child').allInnerTexts(),
    /** Where "Open in VS Code" leads, or "" while there is no such link. */
    vscodeLinkTarget: async (): Promise<string> =>
      (await page.getByRole("link", { name: "Open in VS Code" }).getAttribute("href")) ?? "",
  };
}

function editing(page: Page) {
  return {
    /** Replaces the whole file in the editor with `text`, without saving it. */
    replacesFileInTheEditor: (text: string) => replaceInEditor(page, text),
    /** Saves the file in the editor with Ctrl+S (Cmd+S on a Mac). */
    savesWithTheKeyboard: () => page.keyboard.press("ControlOrMeta+S"),
    /** Replaces the whole file in the editor with `text` and saves with Ctrl+S (Cmd+S on a Mac). */
    replacesFileAndSaves: async (text: string): Promise<void> => {
      await replaceInEditor(page, text);
      await page.keyboard.press("ControlOrMeta+S");
    },
    /** The names of the changed files, as the Changes tab lists them. */
    changedFiles: (): Promise<string[]> =>
      page.locator('[data-testid="changed-files"] li').allInnerTexts(),
    /** The note under the file list saying not all files are listed, or "" when it lists them all. */
    fileListNotice: async (): Promise<string> => {
      return textOf(page.locator('[data-testid="file-tree-notice"]'));
    },
    diffText: (): Promise<string> => plainText(diffOf(page)),
    editorText: (): Promise<string> => plainText(editorOf(page)),
    /** The plain-language note above the editor, or "" when there is none. */
    editorNotice: async (): Promise<string> => {
      return textOf(page.getByRole("status").filter({ hasText: "changed on disk" }));
    },
  };
}
