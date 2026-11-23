import { afterEach, test } from "bun:test";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import {
  expectWorkspaceNotToBeListed,
  expectWorkspaceRowToSay,
} from "../support/browser/workspaces-browser-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

const GHOST_HOST = {
  id: "ghost",
  label: "Ghost host",
  kind: "ssh" as const,
  sshHost: "ghost.example",
  state: "offline" as const,
  reason: "nothing answers there",
  appVersion: "0.0.0",
};

test(
  "a workspace the app stops listing disappears from the workspace menu",
  async () => {
    // ********************************************************************
    // ** GIVEN a page whose menu lists a workspace, because the app lists it
    // ********************************************************************
    const app = await startAppInBrowser();
    await app.page.hasALiveConnectionThatEndsAtOnce();
    const appStopsListingIt = await app.page.hearsOfAnotherWorkspace(GHOST_HOST);
    await app.page.reloads();
    await app.page.opensTheWorkspaceMenu();
    await expectWorkspaceRowToSay(app, { workspace: "Ghost host", text: "nothing answers there" });

    // ********************************************************************
    // ** WHEN the app stops listing it and the page asks for the workspaces again
    // ********************************************************************
    appStopsListingIt();

    // ********************************************************************
    // ** THEN the menu no longer shows that workspace
    // ********************************************************************
    await expectWorkspaceNotToBeListed(app, "Ghost host");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
