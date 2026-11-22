// The part of Playwright the browser tests use, and the one place that loads it.
//
// `playwright` is not in package.json yet (dependencies are added in one place, by the
// orchestrator), so it is loaded at run time by name instead of imported. Once `@playwright/test`
// is a dev dependency, replace `launchChromium` with a plain import and delete these interfaces.

type Name = string | RegExp;
type WaitOptions = { state?: "visible" | "hidden" | "attached" | "detached"; timeout?: number };

export interface Locator {
  click(options?: { timeout?: number }): Promise<void>;
  fill(text: string): Promise<void>;
  press(key: string): Promise<void>;
  waitFor(options?: WaitOptions): Promise<void>;
  count(): Promise<number>;
  innerText(): Promise<string>;
  allInnerTexts(): Promise<string[]>;
  inputValue(): Promise<string>;
  selectOption(choice: { label: string }): Promise<unknown>;
  getByRole(role: string, options?: { name?: Name; exact?: boolean }): Locator;
  getByText(text: Name, options?: { exact?: boolean }): Locator;
  getByLabel(text: Name, options?: { exact?: boolean }): Locator;
  locator(selector: string): Locator;
  filter(options: { hasText?: Name; has?: Locator }): Locator;
  first(): Locator;
}

export interface Page extends Pick<Locator, "locator" | "getByRole" | "getByText" | "getByLabel"> {
  goto(url: string): Promise<unknown>;
  evaluate<T>(script: string): Promise<T>;
  screenshot(options: { path: string }): Promise<unknown>;
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
}

export interface Browser {
  newPage(options?: {
    viewport?: { width: number; height: number };
    colorScheme?: "light" | "dark";
  }): Promise<Page>;
  close(): Promise<void>;
}

type PlaywrightModule = { chromium: { launch(): Promise<Browser> } };

/** Where Playwright might be: by name, then in each global folder named by NODE_PATH. */
function candidates(): string[] {
  const folders = (process.env["NODE_PATH"] ?? "").split(":").filter((folder) => folder !== "");
  return ["playwright", ...folders.map((folder) => `${folder}/playwright`)];
}

async function importFirst(places: string[]): Promise<PlaywrightModule> {
  const [place, ...others] = places;
  if (place === undefined) throw new Error("Playwright is not installed (looked for `playwright`)");
  try {
    return (await import(place)) as PlaywrightModule;
  } catch {
    return importFirst(others);
  }
}

/** Starts a headless Chromium. */
export async function launchChromium(): Promise<Browser> {
  const playwright = await importFirst(candidates());
  return playwright.chromium.launch();
}
