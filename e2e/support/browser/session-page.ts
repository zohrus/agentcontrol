import type { Page } from "./playwright.ts";
import { textOf } from "./read-text.ts";

const streamOf = (page: Page) => page.getByRole("log");

/** Buttons and keys of the composer under the conversation. */
function composer(page: Page) {
  return {
    sendsMessage: async (text: string): Promise<void> => {
      await page.locator("textarea").fill(text);
      await page.getByRole("button", { name: "Send", exact: true }).click();
    },
    /** Types a message and sends it with Ctrl+Enter (Cmd+Enter on a Mac), without the Send button. */
    sendsMessageWithTheKeyboard: async (text: string): Promise<void> => {
      await page.locator("textarea").fill(text);
      await page.keyboard.press("ControlOrMeta+Enter");
    },
    /** Presses Enter alone in the message box: that is a new line, not a send. */
    pressesEnterInTheMessageBox: () => page.locator("textarea").press("Enter"),
    cancelsTheTurn: () => page.getByRole("button", { name: "Cancel", exact: true }).click(),
    /** Whether the Send button can be pressed. */
    sendIsEnabled: () => page.getByRole("button", { name: "Send", exact: true }).isEnabled(),
    /** Presses Archive and confirms in the dialog that opens. */
    archives: async (): Promise<void> => {
      await page.getByRole("button", { name: "Archive", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
    },
  };
}

/** The "Interrupted" banner above the composer, shown when the relay stopped with the agent. */
function resumeBanner(page: Page) {
  const resume = page.getByRole("button", { name: "Resume", exact: true });
  return {
    resumes: () => resume.click(),
    /** Whether the open session offers a Resume button. */
    offersResume: async (): Promise<boolean> => (await resume.count()) > 0,
  };
}

/** The open session: its conversation stream, the permission card and the composer. */
export function sessionPage(page: Page) {
  return {
    ...composer(page),
    allowsTheCommandInTheStream: () =>
      streamOf(page).getByRole("button", { name: "Allow", exact: true }).click(),
    ...resumeBanner(page),
    /** Opens the one-line summary of collapsed lookups ("Read 2 files, searched 1 time"). */
    opensTheCollapsedLookups: () =>
      streamOf(page)
        .locator("summary", { hasText: /^(Read|Searched) / })
        .click(),
    /** Everything the conversation stream shows, or "" while no session is open. */
    streamText: async (): Promise<string> => {
      return textOf(streamOf(page));
    },
    /** The usage chip of the open session's header ("1.5k tokens · $0.02"), or "" before any turn ended. */
    usageChipText: async (): Promise<string> => {
      return textOf(page.locator('[data-testid="usage-chip"]'));
    },
    /** How long the header says the session has been going ("45s", "3h 05m", "2d 4h"). */
    elapsedTimeText: () => page.locator('[title^="Started "]').innerText(),
    /** How many times the stream shows this text. */
    timesTheStreamShows: async (text: string): Promise<number> => {
      const found = await streamOf(page).getByText(text).count();
      return found;
    },
  };
}
