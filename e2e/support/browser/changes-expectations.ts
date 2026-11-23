import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 15_000;

const quote = (text: string): string => JSON.stringify(text);

/** The Editor tab offers exactly these files. */
export function expectEditableFiles(app: AppInBrowser, files: string[]): Promise<void> {
  return eventually(
    `expected the Editor tab to offer ${files.map(quote).join(", ")}`,
    async () => {
      const offered = await app.page.editableFiles();
      return offered.join("|") === files.join("|")
        ? undefined
        : `it offers ${quote(offered.join(", "))}`;
    },
    BROWSER_WAIT_MS,
  );
}

/** "Open in VS Code" leads to a vscode:// address that ends with this path. */
export function expectVscodeLinkToEndWith(app: AppInBrowser, path: string): Promise<void> {
  return eventually(
    `expected "Open in VS Code" to lead to ${path}`,
    async () => {
      const target = await app.page.vscodeLinkTarget();
      const opensVscode = target.startsWith("vscode://file/") && target.endsWith(`/${path}`);
      return opensVscode ? undefined : `it leads to ${quote(target)}`;
    },
    BROWSER_WAIT_MS,
  );
}

/**
 * Reloading the crashed Changes panel brings it back, listing this file. The panel keeps
 * crashing while the page still holds the unreadable changes, so reloading is repeated until
 * the fresh changes have arrived.
 */
export function expectReloadedPanelToListChangedFile(
  app: AppInBrowser,
  path: string,
): Promise<void> {
  return eventually(
    `expected the reloaded Changes panel to list ${path}`,
    async () => {
      await app.page.reloadsThePanel();
      const files = await app.page.changedFiles();
      return files.some((file) => file.startsWith(path)) ? undefined : "the panel is not back yet";
    },
    BROWSER_WAIT_MS,
  );
}
