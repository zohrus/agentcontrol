import { pageEventually, quote } from "./browser-expectations.ts";
import { missingFrom } from "./page-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The header shows all of these texts. */
export function expectHeaderToShow(app: AppInBrowser, ...texts: string[]): Promise<void> {
  return pageEventually(`expected the header to show ${texts.map(quote).join(", ")}`, async () => {
    const shown = await app.page.headerText();
    const missing = missingFrom(shown, texts);
    return missing.length === 0 ? undefined : `it reads ${quote(shown)}`;
  });
}

/** The header shows none of these texts: they moved to the Details. */
export async function expectHeaderToShowNoneOf(
  app: AppInBrowser,
  ...texts: string[]
): Promise<void> {
  const shown = await app.page.headerText();
  const found = texts.filter((text) => shown.includes(text));
  if (found.length === 0) return;
  throw new Error(
    `expected the header not to show ${found.map(quote).join(", ")}, but it reads ${quote(shown)}`,
  );
}

/** The header's status indicator is named after the session's status. */
export function expectHeaderStatusToBe(app: AppInBrowser, status: string): Promise<void> {
  return pageEventually(
    `expected the header's status indicator to say ${quote(status)}`,
    async () => {
      const name = await app.page.statusIndicatorName();
      return name === status ? undefined : `it says ${quote(name)}`;
    },
  );
}

/** The title takes several lines and none of it is cut off. */
export async function expectTitleToWrapWithoutBeingCut(app: AppInBrowser): Promise<void> {
  const header = await app.page.sessionHeader();
  const clipping = await app.page.titleClipping();
  if (header.titleLines >= 2 && !clipping.cut) return;
  throw new Error(
    `expected the title to wrap onto several lines without being cut, but it takes ${String(header.titleLines)} line(s)` +
      (clipping.cut ? ` and is cut: ${clipping.why}` : ""),
  );
}

/** The title is on one line. */
export async function expectTitleOnOneLine(app: AppInBrowser): Promise<void> {
  const header = await app.page.sessionHeader();
  if (header.titleLines === 1) return;
  throw new Error(`expected the title on one line, but it takes ${String(header.titleLines)}`);
}

/** The header's files button says this ("2 files +3 −1"). */
export function expectChangedFilesToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the files button to say ${quote(text)}`, async () => {
    const shown = await app.page.filesButtonText();
    return shown.replaceAll(/\s+/g, " ") === text ? undefined : `it says ${quote(shown)}`;
  });
}

/** The right-hand panel shows its Changes tab. */
export function expectChangesTabToBeOpen(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the Changes tab to be open", async () => {
    return (await app.page.changesTabIsOpen()) ? undefined : "another tab is open";
  });
}

/** The header shows this cost. */
export function expectCostToShow(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the header to show the cost ${quote(text)}`, async () => {
    const shown = await app.page.costText();
    return shown === text ? undefined : `it shows ${quote(shown)}`;
  });
}

/** The header shows no cost. */
export async function expectNoCost(app: AppInBrowser): Promise<void> {
  const shown = await app.page.costText();
  if (shown === "") return;
  throw new Error(`expected the header to show no cost, but it shows ${quote(shown)}`);
}

/** The cost's tooltip gives this token breakdown. */
export function expectCostTooltipToSay(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the cost's tooltip to say ${quote(text)}`, async () => {
    const shown = await app.page.costTooltip();
    return shown === text ? undefined : `it says ${quote(shown)}`;
  });
}

/** The Details panel shows all of these texts. */
export function expectDetailsToShow(app: AppInBrowser, ...texts: string[]): Promise<void> {
  return pageEventually(`expected the details to show ${texts.map(quote).join(", ")}`, async () => {
    const shown = await app.page.detailsText();
    return missingFrom(shown, texts).length === 0 ? undefined : `they read ${quote(shown)}`;
  });
}

/** The Details panel is closed. */
export function expectDetailsToBeClosed(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the details to be closed", async () => {
    return (await app.page.detailsAreOpen()) ? "they are still open" : undefined;
  });
}

/** The Details panel is open. */
export function expectDetailsToBeOpen(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the details to be open", async () => {
    return (await app.page.detailsAreOpen()) ? undefined : "they are closed";
  });
}

/** The ⓘ button has the keyboard focus. */
export function expectDetailsButtonToHaveTheFocus(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the ⓘ button to have the keyboard focus", async () => {
    return (await app.page.detailsButtonHasTheFocus()) ? undefined : "it does not";
  });
}

/** The ⓘ button says (to a screen reader) that its panel is open, or closed. */
export function expectDetailsButtonToSayItIsExpanded(
  app: AppInBrowser,
  expanded: boolean,
): Promise<void> {
  return pageEventually(
    `expected the ⓘ button to say its panel is ${expanded ? "open" : "closed"}`,
    async () => {
      const says = await app.page.detailsButtonSaysItIsExpanded();
      return says === expanded ? undefined : `it says it is ${says ? "open" : "closed"}`;
    },
  );
}

/** Archive is no longer a button of its own, next to the message box. */
export async function expectNoArchiveButtonUnderTheMessageBox(app: AppInBrowser): Promise<void> {
  if (!(await app.page.hasPlainArchiveButton())) return;
  throw new Error("expected no Archive button under the message box, but there is one");
}

/** The computer's clipboard holds exactly this text. */
export function expectClipboardToHold(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the clipboard to hold ${quote(text)}`, async () => {
    const held = await app.page.clipboardText();
    return held === text ? undefined : `it holds ${quote(held)}`;
  });
}
