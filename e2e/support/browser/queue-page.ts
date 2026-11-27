import type { Page } from "./playwright.ts";

/** The queue of messages above the message box, and the buttons on its rows. */
export function queuePage(page: Page) {
  const queue = page.getByRole("region", { name: "Queued messages" });
  const rowOf = (text: string) => queue.getByRole("listitem").filter({ hasText: text });
  return {
    /** The messages in the queue, oldest first; none when there is no queue. */
    queuedMessages: (): Promise<string[]> => queue.locator("li > span").allInnerTexts(),
    /** What the queue's one line says about when its messages are sent. */
    queueNote: async (): Promise<string> => {
      const notes = await queue.getByRole("status").allInnerTexts();
      return notes.join(" ");
    },
    removesTheQueuedMessage: (text: string) =>
      rowOf(text).getByRole("button", { name: "Remove" }).click(),
    editsTheQueuedMessage: (text: string) =>
      rowOf(text).getByRole("button", { name: "Edit" }).click(),
    sendsTheQueuedMessageNow: (text: string) =>
      rowOf(text).getByRole("button", { name: "Send now" }).click(),
    /** Whether the open session offers Cancel, which it does while a turn runs. */
    offersCancel: async (): Promise<boolean> =>
      (await page.getByRole("button", { name: "Cancel", exact: true }).count()) > 0,
    /** Types in the message box without sending. */
    writesWithoutSending: (text: string) => page.locator("textarea").fill(text),
    /** Types a message and sends it with Shift+Enter, without the Send button. */
    sendsMessageWithShiftEnter: async (text: string): Promise<void> => {
      await page.locator("textarea").fill(text);
      await page.locator("textarea").press("Shift+Enter");
    },
  };
}
