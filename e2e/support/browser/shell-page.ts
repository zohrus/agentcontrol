import type { Page } from "./playwright.ts";

const liveStream = "**/api/stream";

/** What happens to the page itself: its address, reloading, the clock and the screen colors. */
function pageItself(page: Page) {
  return {
    /** Types an address into the address bar: only the part after `#`, such as `#/sessions/abc`. */
    goesToAddress: async (hash: string): Promise<void> => {
      await page.evaluate(`window.location.hash = ${JSON.stringify(hash)}`);
    },
    reloads: () => page.reload(),
    /** Moves the page's clock forward; only for a browser started with a controllable clock. */
    letsTimePass: (milliseconds: number) => page.clock.fastForward(milliseconds),
    /** The background color of the page, as the browser paints it. */
    backgroundColor: () => page.evaluate<string>("getComputedStyle(document.body).backgroundColor"),
    switchesToDarkColors: () => page.emulateMedia({ colorScheme: "dark" }),
    switchesToLightColors: () => page.emulateMedia({ colorScheme: "light" }),
  };
}

/** The top bar buttons that open a dialog, and the guide shown in an empty app. */
function topBar(page: Page) {
  return {
    choosesToAddARepositoryFromTheGuide: () =>
      page.getByRole("button", { name: "Add a repository", exact: true }).click(),
    choosesToStartTheFirstSession: () =>
      page.getByRole("button", { name: "Start your first session", exact: true }).click(),
    /** Presses "Reload this panel" when a crashed panel offers it; says whether it did. */
    reloadsThePanel: async (): Promise<boolean> => {
      const reload = page.getByRole("button", { name: "Reload this panel" });
      if ((await reload.count()) === 0) return false;
      await reload.click();
      return true;
    },
    opensAnalytics: () => page.getByRole("button", { name: "Analytics", exact: true }).click(),
  };
}

/** The messages in the corner of the screen. */
function toasts(page: Page) {
  // By CSS: an open dialog hides everything behind it from role queries, and messages show up there too.
  const alerts = page
    .locator('[role="alert"]')
    .filter({ has: page.locator('[aria-label="Dismiss"]') });
  return {
    /** The text of every message shown in the corner. */
    toastTexts: (): Promise<string[]> => alerts.allInnerTexts(),
    dismissesTheToast: () => alerts.first().locator('[aria-label="Dismiss"]').click(),
  };
}

/** Answers from the app that are late, unreadable or unexpected, as a bug would cause. */
function badAnswers(page: Page) {
  return {
    /** Answers from the app reach the page as usual again. */
    getsRealAnswersAgain: () => page.unrouteAll({ behavior: "ignoreErrors" }),
    /** The app's answer to this path is something the page cannot read. */
    getsGarbageFrom: async (path: string): Promise<void> => {
      await page.route(`**${path}`, (route) =>
        route.fulfill({ status: 200, contentType: "text/plain", body: "this is not json" }),
      );
    },
    /** What the app answers to a read of a file's contents is something the page cannot read. */
    getsUnreadableFileContents: async (): Promise<void> => {
      await page.route(/\/api\/sessions\/[^/]+\/file\?/, (route) =>
        route.fulfill({ status: 200, contentType: "text/plain", body: "this is not json" }),
      );
    },
    /** The app refuses a request to this path with an internal error carrying this message. */
    getsAnErrorFrom: async (path: string, message: string): Promise<void> => {
      await page.route(`**${path}`, (route) =>
        route.fulfill({ status: 500, json: { error: { code: "internal-error", message } } }),
      );
    },
    /** The app's answer to this path is valid but not what the page expects. */
    getsAnUnexpectedAnswerFrom: async (path: string): Promise<void> => {
      await page.route(`**${path}`, (route) =>
        route.fulfill({ status: 200, json: { files: null } }),
      );
    },
  };
}

/** Answers from the app that arrive late. */
function lateAnswers(page: Page) {
  return {
    /**
     * The contents of files stop reaching the page until the returned function is called. Saving
     * and everything else go through, so the page keeps showing the version it already had.
     */
    holdsBackFileContents: async (): Promise<() => void> => {
      let release = (): void => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(/\/api\/sessions\/[^/]+\/file\?/, async (route) => {
        await released;
        await route.continue();
      });
      return release;
    },
  };
}

/** Trouble on the way between the page and the app, as a flaky network would cause it. */
function trouble(page: Page) {
  return {
    /** Starts watching for the app to refuse the page's secret; resolves when it has. */
    watchesForARefusedSecret: (): Promise<unknown> =>
      page.waitForResponse((response) => response.status() === 401),
    /** The whole network goes away: the page can neither listen nor ask. */
    losesTheNetwork: () => page.context().setOffline(true),
    /** New live connections to the app fail, so a connection that drops cannot come back. */
    cannotReachTheLiveStream: async (): Promise<void> => {
      await page.route(liveStream, (route) => route.abort());
    },
    canReachTheLiveStreamAgain: (): Promise<void> => page.unroute(liveStream),
  };
}

/** The shell around the panes: the top bar, messages, the page's own state and its network. */
export function shellPage(page: Page) {
  return {
    ...pageItself(page),
    ...topBar(page),
    ...toasts(page),
    ...badAnswers(page),
    ...lateAnswers(page),
    ...trouble(page),
  };
}
