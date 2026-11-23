import { pageEventually } from "./browser-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The open session offers a Resume button: its agent stopped when the relay did. */
export function expectResumeToBeOffered(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the open session to offer Resume", async () => {
    return (await app.page.offersResume()) ? undefined : "it does not";
  });
}

/** The open session no longer offers Resume: a new agent runs for it. */
export function expectResumeNotToBeOffered(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the open session to stop offering Resume", async () => {
    return (await app.page.offersResume()) ? "it still does" : undefined;
  });
}
