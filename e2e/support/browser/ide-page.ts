import type { Page } from "./playwright.ts";

const BUTTON = "Open in browser VS Code";

/** The "Open in browser VS Code" button in the session panel, in the words of the UI. */
export function idePage(page: Page) {
  const button = page.getByRole("button", { name: BUTTON });
  return {
    /** Clicks the button; resolves with the new tab it opens. */
    opensBrowserVsCodeInANewTab: async (): Promise<Page> => {
      const [tab] = await Promise.all([page.waitForEvent("popup"), button.click()]);
      return tab;
    },
    /** Clicks the button and does not wait for a tab (none opens when starting fails). */
    clicksOpenInBrowserVsCode: () => button.click(),
    /** Whether the button can be clicked, once the app has said whether code-server can be opened. */
    browserVsCodeButtonIsEnabled: (): Promise<boolean> => button.isEnabled(),
    /** What the button says about itself when hovered: why it is disabled, or what it does. */
    browserVsCodeButtonNote: async (): Promise<string> =>
      (await button.getAttribute("title")) ?? "",
  };
}
