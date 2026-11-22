import type { Page } from "./playwright.ts";

const streamOf = (page: Page) => page.getByRole("log");

/** The open session: its conversation stream, the permission card and the composer. */
export function sessionPage(page: Page) {
  return {
    allowsTheCommandInTheStream: () =>
      streamOf(page).getByRole("button", { name: "Allow", exact: true }).click(),
    sendsMessage: async (text: string): Promise<void> => {
      await page.locator("textarea").fill(text);
      await page.getByRole("button", { name: "Send", exact: true }).click();
    },
    archives: () => page.getByRole("button", { name: "Archive", exact: true }).click(),
    /** Everything the conversation stream shows, or "" while no session is open. */
    streamText: async (): Promise<string> => {
      const stream = streamOf(page);
      return (await stream.count()) === 0 ? "" : stream.innerText();
    },
    /** How many times the stream shows this text. */
    timesTheStreamShows: async (text: string): Promise<number> => {
      const found = await streamOf(page).getByText(text).count();
      return found;
    },
  };
}
