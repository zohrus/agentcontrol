import type { Page } from "./playwright.ts";

/** Runs in the page: the families of the fonts the browser has loaded so far. */
const LOADED_FAMILIES = `[...document.fonts]
  .filter((face) => face.status === "loaded")
  .map((face) => face.family.replaceAll('"', ""))`;

const familyOf = (selector: string): string =>
  `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).fontFamily`;

/** Every address a tab asked for, from the moment it was opened (the page's own list is too short to hold them all). */
const requested = new WeakMap<Page, string[]>();

/** Starts keeping the addresses the tab asks for. */
export function recordRequests(page: Page): void {
  const addresses: string[] = [];
  requested.set(page, addresses);
  page.on("request", (request) => {
    addresses.push(request.url());
  });
}

const THIS_MACHINE = new Set(["127.0.0.1", "localhost"]);
const NETWORK = new Set(["http:", "https:", "ws:", "wss:"]);

const leavesThisMachine = (address: string): boolean => {
  const url = new URL(address);
  return NETWORK.has(url.protocol) && !THIS_MACHINE.has(url.hostname);
};

/** The fonts the page uses, as the browser reports them, and where it got them from. */
export function fontsPage(page: Page) {
  const addresses = (): string[] => requested.get(page) ?? [];
  return {
    /** The families of the font files the browser has loaded, for example ["Inter"]. */
    loadedFontFamilies: () => page.evaluate<string[]>(LOADED_FAMILIES),
    /** Whether the browser reports the font as available for text at 13 px (it is loaded, or none is declared). */
    fontIsAvailable: (family: string) =>
      page.evaluate<boolean>(`document.fonts.check(${JSON.stringify(`13px "${family}"`)})`),
    /** The font stack the page text is set in. */
    bodyFontFamily: () => page.evaluate<string>(familyOf("body")),
    /** The font stack of the first element that matches. */
    fontFamilyOf: (selector: string) => page.evaluate<string>(familyOf(selector)),
    /** The font files the page asked for. */
    fontFilesAskedFor: (): string[] =>
      addresses().filter((address) => new URL(address).pathname.endsWith(".woff2")),
    /** Everything the page asked for from anywhere but this machine. */
    addressesAskedForOutsideThisMachine: (): string[] => addresses().filter(leavesThisMachine),
  };
}
