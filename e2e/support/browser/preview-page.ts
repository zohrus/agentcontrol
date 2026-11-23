import type { Page } from "./playwright.ts";
import { firstTextOf, textOf } from "./read-text.ts";

const LINK_WAIT_MS = 15_000;

const frameOf = (page: Page) => page.frameLocator('[data-testid="preview-frame"]');

/** The text of the first element matching `selector` inside the preview, "" when there is none. */
async function textInPreview(page: Page, selector: string): Promise<string> {
  return firstTextOf(frameOf(page).locator(selector));
}

async function linkOpening(page: Page, text: string): Promise<{ target: string; rel: string }> {
  const link = frameOf(page).getByRole("link", { name: text });
  return {
    target: (await link.getAttribute("target")) ?? "",
    rel: (await link.getAttribute("rel")) ?? "",
  };
}

async function imageHasLoaded(page: Page): Promise<boolean> {
  const image = frameOf(page).locator("img").first();
  if ((await image.count()) === 0) return false;
  return image.evaluate((element: unknown) => {
    const { complete, naturalWidth } = element as { complete: boolean; naturalWidth: number };
    return complete && naturalWidth > 0;
  });
}

/** What the previewed page or document shows, read from inside its frame. */
export function previewContent(page: Page) {
  return {
    /** What the preview's heading says now, "" when it has none yet. */
    previewHeading: (): Promise<string> => textInPreview(page, "h1"),
    previewTableText: (): Promise<string> => textInPreview(page, "table"),
    previewCodeBlock: (): Promise<string> => textInPreview(page, "pre code"),
    previewResult: (): Promise<string> => textInPreview(page, "#result"),
    /** How many `script` elements the previewed document holds. */
    previewScriptCount: (): Promise<number> => frameOf(page).locator("script").count(),
    /** How many elements of the previewed document carry an inline event handler. */
    previewHandlerCount: (): Promise<number> =>
      frameOf(page).locator("[onerror], [onclick], [onload]").count(),
    /** The `target` and `rel` of the previewed link with this text, "" for an attribute it lacks. */
    previewLinkOpening: (text: string) => linkOpening(page, text),
    /** True when the first image of the previewed document has loaded and has a size. */
    previewImageHasLoaded: () => imageHasLoaded(page),
  };
}

/** The Preview tab around the frame: opening it, its buttons, and the frame's own attributes. */
export function previewPage(page: Page) {
  const link = page.getByRole("link", { name: "Open in new tab" });
  return {
    opensPreviewTab: () => page.getByRole("tab", { name: "Preview" }).click(),
    /** Uses the small "Preview" button next to a file in the Changes list. */
    previewsFileFromTheList: (path: string) =>
      page
        .getByRole("button", { name: `Preview ${path}`, exact: true })
        .first()
        .click(),
    reloadsThePreview: () => page.getByRole("button", { name: "Reload" }).click(),
    /** Gives the app's page a mark that a reload would erase. */
    marksTheAppPage: () => page.evaluate("window.markedByTheTest = true"),
    appPageStillHasItsMark: () => page.evaluate<boolean>("window.markedByTheTest === true"),
    /** The address the Open in new tab link points to, once the page has one. */
    previewOpenAddress: async (): Promise<string> => {
      await link.waitFor({ timeout: LINK_WAIT_MS });
      return new URL((await link.getAttribute("href")) ?? "", page.url()).href;
    },
    previewFrameSandbox: async (): Promise<string> =>
      (await page.locator('[data-testid="preview-frame"]').getAttribute("sandbox")) ?? "",
    previewNotice: async (): Promise<string> => {
      return textOf(page.locator('[data-testid="preview-picker"]'));
    },
  };
}
