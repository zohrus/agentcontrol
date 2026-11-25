import type { Page } from "./playwright.ts";

/** Runs in the page: the root fiber React keeps on the element it rendered into, if it did. */
const REACT_RUNS_IN_DEVELOPMENT_MODE = `(() => {
  const root = document.getElementById("root");
  const key = root && Object.keys(root).find((name) => name.startsWith("__reactContainer$"));
  return root && key ? "_debugOwner" in root[key] : undefined;
})()`;

/** Runs in the page: whether any file the page loaded came from Vite's dev server. */
const LOADED_DEVELOPMENT_SERVER_FILES = `performance.getEntriesByType("resource")
  .some((entry) => /\\/@vite\\/|\\/src\\//.test(new URL(entry.name).pathname))`;

/** What the page itself can tell about how its UI was built. */
export function buildPage(page: Page) {
  return {
    /**
     * Whether React runs its development build. That build keeps `_debugOwner` on every fiber;
     * the production build does not. Undefined when React has not rendered anything yet.
     */
    reactRunsInDevelopmentMode: () =>
      page.evaluate<boolean | undefined>(REACT_RUNS_IN_DEVELOPMENT_MODE),
    /** Whether the page loaded Vite's development client or any of the UI's source modules. */
    loadedDevelopmentServerFiles: () => page.evaluate<boolean>(LOADED_DEVELOPMENT_SERVER_FILES),
  };
}
