import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 15_000;

const quote = (text: string): string => JSON.stringify(text);

/** Waits for a text the preview should show, naming what it showed instead. */
function previewEventually(
  expectation: string,
  options: { read: () => Promise<string>; wanted: string },
): Promise<void> {
  return eventually(
    expectation,
    async () => {
      const seen = await options.read();
      return seen.includes(options.wanted) ? undefined : `it shows ${quote(seen)}`;
    },
    BROWSER_WAIT_MS,
  );
}

/** The preview's heading reads this text (a script in the page may be what wrote it). */
export function expectPreviewHeadingToRead(app: AppInBrowser, text: string): Promise<void> {
  return previewEventually(`expected the preview's heading to read ${quote(text)}`, {
    read: () => app.page.previewHeading(),
    wanted: text,
  });
}

/** The preview shows a table with this text in it. */
export function expectPreviewToShowTableWith(app: AppInBrowser, text: string): Promise<void> {
  return previewEventually(`expected the preview to show a table with ${quote(text)}`, {
    read: () => app.page.previewTableText(),
    wanted: text,
  });
}

/** The preview shows a code block with this code in it. */
export function expectPreviewToShowCodeBlockWith(app: AppInBrowser, code: string): Promise<void> {
  return previewEventually(`expected the preview to show a code block with ${quote(code)}`, {
    read: () => app.page.previewCodeBlock(),
    wanted: code,
  });
}

/** The page's own script wrote this into the page, which shows that it ran in the preview. */
export function expectPreviewScriptToHaveReported(app: AppInBrowser, text: string): Promise<void> {
  return previewEventually(`expected the page's script to report ${quote(text)}`, {
    read: () => app.page.previewResult(),
    wanted: text,
  });
}

/** The page's script was told it may not reach the API, and the page did not get any answer. */
export async function expectPreviewScriptNotToHaveReachedTheApi(app: AppInBrowser): Promise<void> {
  const result = await app.page.previewResult();
  if (result.includes("reached the API")) {
    throw new Error(`expected the page not to reach the API, but it says: ${quote(result)}`);
  }
}

/** The previewed document has no script and no inline event handler left in it. */
export async function expectPreviewToHoldNothingThatRuns(app: AppInBrowser): Promise<void> {
  const scripts = await app.page.previewScriptCount();
  const handlers = await app.page.previewHandlerCount();
  if (scripts + handlers > 0) {
    throw new Error(
      `expected no script or event handler in the preview, but found ${String(scripts)} scripts and ${String(handlers)} handlers`,
    );
  }
}

/** The app's own page was not reloaded since the test marked it. */
export async function expectTheAppPageNotToHaveReloaded(app: AppInBrowser): Promise<void> {
  if (!(await app.page.appPageStillHasItsMark())) {
    throw new Error("expected the app page to stay as it was, but it was reloaded");
  }
}

/** The preview shows an image that loaded (not a broken-image icon). */
export function expectPreviewToShowItsImage(app: AppInBrowser): Promise<void> {
  return eventually(
    "expected the preview to show its image",
    async () => ((await app.page.previewImageHasLoaded()) ? undefined : "the image has not loaded"),
    BROWSER_WAIT_MS,
  );
}

/** The frame that holds the page has exactly these sandbox flags, none that reach the app. */
export async function expectPreviewFrameToBeSandboxedWith(
  app: AppInBrowser,
  flags: string,
): Promise<void> {
  const sandbox = await app.page.previewFrameSandbox();
  if (sandbox !== flags) {
    throw new Error(
      `expected the preview frame to be sandboxed with "${flags}", but it has "${sandbox}"`,
    );
  }
}

/** The Open in new tab link has been given a different address than `before`: a fresh load. */
export function expectPreviewToHaveBeenLoadedAgain(
  app: AppInBrowser,
  before: string,
): Promise<void> {
  return eventually(
    "expected the preview to be loaded again",
    async () =>
      (await app.page.previewOpenAddress()) === before ? "its address is the same" : undefined,
    BROWSER_WAIT_MS,
  );
}

/** The link with this text opens in a new tab that cannot reach back into the app. */
export async function expectPreviewLinkToOpenInANewTab(
  app: AppInBrowser,
  text: string,
): Promise<void> {
  const { target, rel } = await app.page.previewLinkOpening(text);
  if (target !== "_blank" || !rel.includes("noopener")) {
    throw new Error(
      `expected the link "${text}" to open in a new tab with noopener, but target is "${target}" and rel is "${rel}"`,
    );
  }
}

/** The link with this text stays in the document, so it can scroll to its section. */
export async function expectPreviewLinkToStayInTheDocument(
  app: AppInBrowser,
  text: string,
): Promise<void> {
  const { target } = await app.page.previewLinkOpening(text);
  if (target !== "") {
    throw new Error(
      `expected the link "${text}" to stay in the document, but it opens "${target}"`,
    );
  }
}

/** The preview tab says plainly that it has nothing to show and why. */
export function expectPreviewToExplain(app: AppInBrowser, words: string): Promise<void> {
  return previewEventually(`expected the Preview tab to say ${quote(words)}`, {
    read: () => app.page.previewNotice(),
    wanted: words,
  });
}
