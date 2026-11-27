import { pageEventually, quote } from "./browser-expectations.ts";
import type { AppPage } from "./app-page.ts";

/** The browser has loaded the font file of this family, and says the family is available. */
export function expectFontToBeLoaded(page: AppPage, family: string): Promise<void> {
  return pageEventually(`expected the font ${quote(family)} to be loaded`, async () => {
    const loaded = await page.loadedFontFamilies();
    if (!loaded.includes(family)) return `only ${quote(loaded.join(", "))} are loaded`;
    return (await page.fontIsAvailable(family))
      ? undefined
      : "the browser says it is not available";
  });
}

/** The font stack of the element that matches the selector starts with this family. */
export async function expectFontStackToStartWith(
  page: AppPage,
  call: { selector: string; family: string },
): Promise<void> {
  const stack = await page.fontFamilyOf(call.selector);
  if (stack.startsWith(call.family) || stack.startsWith(`"${call.family}"`)) return;
  throw new Error(
    `expected ${call.selector} to be set in ${call.family}, but its fonts are ${quote(stack)}`,
  );
}

/** The page's own text is set in this font first. */
export function expectPageTextToBeSetIn(page: AppPage, family: string): Promise<void> {
  return expectFontStackToStartWith(page, { selector: "body", family });
}

/** The page asked for its two font files, and for nothing at all from outside this machine. */
export function expectNothingToBeFetchedFromOutside(page: AppPage): void {
  const files = page.fontFilesAskedFor();
  if (files.length === 0) throw new Error("expected the page to have asked for its font files");
  const outside = page.addressesAskedForOutsideThisMachine();
  if (outside.length === 0) return;
  throw new Error(
    `expected nothing to be fetched from outside this machine, but the page asked for ${outside.join(", ")}`,
  );
}
