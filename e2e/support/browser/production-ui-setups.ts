import { readModifyConfig } from "@agentcontrol/app";
import { startsAppLikeARelease } from "../setup/production-ui.ts";
import { startAppWithLocalWorkspace } from "../setup/start-app.ts";
import { type AppPage, appPageOf } from "./app-page.ts";
import { openTab } from "./open-tab.ts";
import { openInBrowser } from "./start-app-in-browser.ts";

/** The app started like a release, with the real default UI, open in a browser. */
export async function startReleaseWithTheDefaultUiInABrowser() {
  const app = await startAppWithLocalWorkspace({
    productionUi: true,
    modify: { ...readModifyConfig(process.env), agent: "mock" },
  });
  return openInBrowser(app);
}

/** The app started like a release, with a tiny UI that shows its session table, open in a browser. */
export async function startReleaseWithATinyUiInABrowser() {
  const app = await startsAppLikeARelease();
  const tab = await openTab();
  await tab.goto(app.baseUrl);
  const page: AppPage = appPageOf(tab);
  return Object.assign(app, { page });
}
