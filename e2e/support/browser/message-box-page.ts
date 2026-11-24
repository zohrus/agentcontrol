import type { Page } from "./playwright.ts";

/** The message box under the open session's conversation. */
export function messageBoxPage(page: Page) {
  return {
    writesInTheMessageBox: (text: string) => page.locator("textarea").fill(text),
    pressesSend: () => page.getByRole("button", { name: "Send", exact: true }).click(),
    /** What is written in the message box now. */
    messageBoxText: () => page.locator("textarea").inputValue(),
  };
}
