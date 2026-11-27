import type { Page } from "./playwright.ts";
import { firstTextOf, textOf } from "./read-text.ts";
import { runsOn } from "./stable-stream-page.ts";

/** Whether the title is cut by a clip or an ellipsis (run in the page), and why. */
type TitleClipping = { cut: boolean; why: string };

const TITLE_CLIPPING = `(bar) => {
  const title = bar.querySelector("h4");
  const style = getComputedStyle(title);
  const reasons = [];
  if (style.textOverflow === "ellipsis") reasons.push("it has an ellipsis");
  if (style.overflow !== "visible") reasons.push("it hides what overflows");
  if (title.scrollWidth > title.clientWidth) reasons.push("it is wider than its box");
  return { cut: reasons.length > 0, why: reasons.join(", ") };
}`;

const headerOf = (page: Page) => page.locator("header:has(h4)").first();
const detailsOf = (page: Page) => page.getByRole("dialog", { name: "Session details" });
const detailsButtonOf = (page: Page) => page.getByRole("button", { name: "Details", exact: true });
const archiveItemOf = (page: Page) =>
  page.getByRole("button", { name: "Archive session…", exact: true });

/** The open session's header: title, status, changed files, cost, and the Details button. */
function header(page: Page) {
  return {
    /** Everything the header says. */
    headerText: () => textOf(headerOf(page)),
    /** The header's status indicator is named after the session's status ("running", "idle"). */
    statusIndicatorName: async (): Promise<string> =>
      (await headerOf(page).getByRole("img").first().getAttribute("aria-label")) ?? "",
    /** The files button: "3 files +61 −2", or "" while the header has none. */
    filesButtonText: () => firstTextOf(headerOf(page).getByRole("button", { name: /\bfiles?\b/ })),
    pressesTheChangedFilesButton: () =>
      headerOf(page)
        .getByRole("button", { name: /\bfiles?\b/ })
        .click(),
    /** The cost next to the files button ("$1.84"), or "" before there is any usage. */
    costText: () => firstTextOf(page.locator('[data-testid="session-cost"]')),
    /** Whether the title is cut off. */
    titleClipping: () => runsOn<TitleClipping>(headerOf(page), TITLE_CLIPPING, null),
    /** What hovering the cost shows: the token breakdown. */
    costTooltip: async (): Promise<string> =>
      (await page.locator('[data-testid="session-cost"]').getAttribute("title")) ?? "",
  };
}

/** The Details panel the ⓘ button opens, and what can be done in it. */
function details(page: Page) {
  return {
    opensTheDetails: async (): Promise<void> => {
      await detailsButtonOf(page).click();
      await detailsOf(page).waitFor();
    },
    /** Everything the Details panel says, or "" while it is closed. */
    detailsText: () => textOf(detailsOf(page)),
    detailsAreOpen: async (): Promise<boolean> => (await detailsOf(page).count()) > 0,
    /** Puts the keyboard focus on the ⓘ button and presses Enter, as without a mouse. */
    opensTheDetailsWithTheKeyboard: async (): Promise<void> => {
      await detailsButtonOf(page).focus();
      await page.keyboard.press("Enter");
      await detailsOf(page).waitFor();
    },
    /** Whether the ⓘ button says its panel is open, as a screen reader hears it. */
    detailsButtonSaysItIsExpanded: async (): Promise<boolean> =>
      (await detailsButtonOf(page).getAttribute("aria-expanded")) === "true",
    closesTheDetailsWithEscape: () => page.keyboard.press("Escape"),
    /** Clicks on the conversation, outside of the panel. */
    clicksOutsideTheDetails: () => page.getByRole("log").click({ position: { x: 20, y: 20 } }),
    /** Whether the ⓘ button has the keyboard focus. */
    detailsButtonHasTheFocus: () =>
      page.evaluate<boolean>("document.activeElement?.getAttribute('aria-label') === 'Details'"),
    copiesTheBranchName: () =>
      detailsOf(page).getByRole("button", { name: "Copy branch name" }).click(),
    /** What the computer's clipboard holds. */
    clipboardText: () => page.evaluate<string>("navigator.clipboard.readText()"),
  };
}

/** Archiving from the Details panel. */
function archiving(page: Page) {
  const archiveItem = archiveItemOf(page);
  return {
    /** Whether the page has a button that is just "Archive" (the old one under the message box). */
    hasPlainArchiveButton: async (): Promise<boolean> =>
      (await page.getByRole("button", { name: "Archive", exact: true }).count()) > 0,
    /** Whether the Details panel offers Archive. */
    detailsOfferArchive: async (): Promise<boolean> => (await archiveItem.count()) > 0,
    /** Opens the Details and presses Archive; the dialog that asks to confirm opens. */
    asksToArchive: async (): Promise<void> => {
      await detailsButtonOf(page).click();
      await archiveItem.click();
    },
    /** Confirms in the archive dialog. */
    confirmsTheArchive: () =>
      page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click(),
    /** Opens the Details, presses Archive and confirms in the dialog that opens. */
    archives: async (): Promise<void> => {
      await detailsButtonOf(page).click();
      await archiveItem.click();
      await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
    },
  };
}

export function headerPage(page: Page) {
  return { ...header(page), ...details(page), ...archiving(page) };
}
