import { afterEach, test } from "bun:test";
import { expectDialogToShow } from "../support/browser/page-expectations.ts";
import { expectChecklistStep } from "../support/browser/page-expectations.ts";
import { startSshAppInBrowser } from "../support/browser/start-ssh-app-in-browser.ts";
import { expectWorkspaceRowToSay } from "../support/browser/workspaces-browser-expectations.ts";
import { expectWorkspaceGroupToShow } from "../support/browser/workspaces-browser-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

// Every ssh call is a real handshake and the suite runs files side by side.
const SSH_BROWSER_TEST_TIMEOUT_MS = 90_000;

afterEach(cleanUpAfterTest);

test(
  "adding an ssh workspace shows its checklist completing and the workspace connected",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open and another machine can be reached over ssh
    // ********************************************************************
    const app = await startSshAppInBrowser();

    // ********************************************************************
    // ** WHEN the user opens the workspace menu and adds that host
    // ********************************************************************
    await app.page.opensTheWorkspaceMenu();
    await app.page.choosesAddWorkspace();
    await app.page.typesTheHost(app.host.alias);
    await app.page.submitsTheHost();

    // ********************************************************************
    // ** THEN the checklist shows the relay installed and running, and says it is connected
    // ********************************************************************
    await expectChecklistStep(app, { label: "Relay installed", state: "Passed", text: "" });
    await expectChecklistStep(app, { label: "Relay running", state: "Passed", text: "Connected" });
    await expectDialogToShow(app, "The workspace is connected.");
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a session started on the ssh workspace from New session appears under that workspace",
  async () => {
    // ********************************************************************
    // ** GIVEN the ssh host is a connected workspace, whose agent will reply
    // ********************************************************************
    const app = await startSshAppInBrowser();
    await app.ssh.addsTheHost();
    app.host.mockAgent.willReply("Done on the host");
    await app.host.mockAgent.writeScript();

    // ********************************************************************
    // ** WHEN the user starts a session choosing that workspace first
    // ********************************************************************
    await app.page.startsSessionOnWorkspace({
      workspace: app.host.alias,
      repoPath: app.host.repoPath,
      prompt: "Fix it remotely",
    });

    // ********************************************************************
    // ** THEN the session is listed under the workspace's name
    // ********************************************************************
    await expectWorkspaceGroupToShow(app, {
      workspace: app.host.alias,
      texts: ["Fix it remotely", "Connected"],
    });
    // AND the menu shows the workspace as connected
    await app.page.opensTheWorkspaceMenu();
    await expectWorkspaceRowToSay(app, { workspace: app.host.alias, text: "Connected" });
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);
