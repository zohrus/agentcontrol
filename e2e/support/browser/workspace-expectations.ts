import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 15_000;

/** The app keeps this worktree setup for the local repository. */
export function expectRepoSetupToBeKept(
  app: AppInBrowser,
  setup: { copyFiles: string[]; setupScript: string },
): Promise<void> {
  const wanted = JSON.stringify(setup);
  return eventually(
    `expected the repository to keep the setup ${wanted}`,
    async () => {
      const repo = (await app.user.listsTheRepos()).find((known) => known.path === app.repoPath);
      const kept = JSON.stringify({
        copyFiles: repo?.setup.copyFiles,
        setupScript: repo?.setup.setupScript,
      });
      return kept === wanted ? undefined : `it keeps ${kept}`;
    },
    BROWSER_WAIT_MS,
  );
}

/** The Save setup button can (or cannot) be pressed. */
export function expectSaveSetupToBe(
  app: AppInBrowser,
  state: "enabled" | "disabled",
): Promise<void> {
  return eventually(
    `expected Save setup to be ${state}`,
    async () => {
      const enabled = await app.page.saveSetupIsEnabled();
      return enabled === (state === "enabled")
        ? undefined
        : `it is ${enabled ? "enabled" : "disabled"}`;
    },
    BROWSER_WAIT_MS,
  );
}
