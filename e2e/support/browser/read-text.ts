import type { Locator } from "./playwright.ts";

const MOVED_ON = /Execution context was destroyed|navigation|frame was detached|Target.*closed/i;
const MOST_RETRIES = 5;

/** Whether the read failed only because the page navigated while it was read. */
const pageMovedOn = (error: unknown): boolean =>
  error instanceof Error && MOVED_ON.test(error.message);

/**
 * What the locator's elements say now, read in one step: an element that goes away is simply not
 * in the answer, and a page that navigates while it is read is read again once it has loaded.
 * (Counting first and reading after leaves a gap in which the element can disappear.)
 */
export async function textsOf(locator: Locator, attempt = 1): Promise<string[]> {
  try {
    return await locator.allInnerTexts();
  } catch (error) {
    if (!pageMovedOn(error) || attempt >= MOST_RETRIES) throw error;
    await locator.page().waitForLoadState("domcontentloaded");
    return textsOf(locator, attempt + 1);
  }
}

/** The text of everything the locator matches, one match per line; "" when it matches nothing. */
export async function textOf(locator: Locator): Promise<string> {
  return (await textsOf(locator)).join("\n");
}

/** The text of the first match, "" when there is none. */
export async function firstTextOf(locator: Locator): Promise<string> {
  return (await textsOf(locator))[0] ?? "";
}
