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
    /** Presses "Send again" under a message that was not sent. */
    sendsAgain: () => page.getByRole("button", { name: "Send again" }).click(),
    cancelsTheTurn: () => page.getByRole("button", { name: "Cancel", exact: true }).click(),
    /** Whether the Send button can be pressed. */
    sendIsEnabled: () => page.getByRole("button", { name: "Send", exact: true }).isEnabled(),
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

/** The blocks of the stream that say what starting and archiving the session did, step by step. */
function setupBlocks(page: Page) {
  const open = (heading: RegExp) => streamOf(page).locator("summary", { hasText: heading }).click();
  return {
    /** Opens the "Worktree setup finished" block, which holds the setup steps and lines. */
    opensTheSetupOutput: () => open(/^Worktree setup/),
    /** Opens the "Archived · 1.2 s" block, which holds the steps of archiving. */
    opensTheArchiveSteps: () => open(/^Archiv/),
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
    ...setupBlocks(page),
    /** Everything the conversation stream shows, or "" while no session is open. */
    streamText: async (): Promise<string> => {
      return textOf(streamOf(page));
    },
    /** How long the Details say the session has been going ("45s", "3h 05m", "2d 4h"); they must be open. */
    elapsedTimeText: () => page.locator('[title^="Started "]').innerText(),
    /** How many times the stream shows this text. */
    timesTheStreamShows: async (text: string): Promise<number> => {
      const found = await streamOf(page).getByText(text).count();
      return found;
    },
  };
}
