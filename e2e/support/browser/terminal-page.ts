import type { Page } from "./playwright.ts";

const TERMINAL_WAIT_MS = 15_000;

/** The Terminal tab of the right-hand panel, in the words of the UI. */
export function terminalPage(page: Page) {
  const screen = page.getByTestId("terminal");
  const rows = screen.locator(".xterm-rows");
  return {
    opensTerminalTab: () => page.getByRole("tab", { name: "Terminal" }).click(),
    opensChangesTab: () => page.getByRole("tab", { name: /^Changes/ }).click(),
    /** Types into the terminal as a user at the keyboard does, then presses Enter. */
    typesInTerminal: async (command: string): Promise<void> => {
      await screen.click();
      await page.keyboard.type(command);
      await page.keyboard.press("Enter");
    },
    /** Everything the terminal shows now, one line per row. */
    terminalText: async (): Promise<string> => {
      await rows.waitFor({ timeout: TERMINAL_WAIT_MS });
      return rows.innerText();
    },
    /** The plain-language bar under the terminal once its shell ended, "" while it runs. */
    terminalEndNote: async (): Promise<string> => {
      const note = page.getByRole("status").filter({ hasText: /shell|terminal/i });
      return (await note.count()) === 0 ? "" : note.first().innerText();
    },
    /** Makes the browser window this big, which the panel follows. */
    resizesTheWindow: (size: { width: number; height: number }) => page.setViewportSize(size),
    startsANewTerminal: () => page.getByRole("button", { name: "New terminal" }).click(),
  };
}
