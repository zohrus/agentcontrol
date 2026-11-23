import { afterEach, test } from "bun:test";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import { startSshAppInBrowser } from "../support/browser/start-ssh-app-in-browser.ts";
import { startSshAppWithASession } from "../support/browser/workspaces-setups.ts";
import {
  expectConfirmationToSay,
  expectWorkspaceGroupToShow,
  expectWorkspaceRowToSay,
} from "../support/browser/workspaces-browser-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startOldRelayOnHost } from "../support/setup/ssh-old-relay.ts";
import { expectWorkspaceListedAs } from "../support/expect/ssh-expectations.ts";

// Every ssh call is a real handshake and the suite runs files side by side.
const SSH_BROWSER_TEST_TIMEOUT_MS = 90_000;

afterEach(cleanUpAfterTest);

test(
  "sessions of a workspace that went offline are read-only and say why",
  async () => {
    // ********************************************************************
    // ** GIVEN a session on a connected ssh workspace, shown in the list
    // ********************************************************************
    const { app, workspace } = await startSshAppWithASession("Keep going");

    // ********************************************************************
    // ** WHEN the host becomes unreachable
    // ********************************************************************
    app.host.network.goesDown();
    await expectWorkspaceListedAs(app, { workspace, state: "offline" });

    // ********************************************************************
    // ** THEN the list shows the workspace offline, with the reason, and its session read-only
    // ********************************************************************
    await expectWorkspaceGroupToShow(app, {
      workspace: app.host.alias,
      texts: ["Offline", "refused the connection", "read-only"],
    });
    // AND the open session says it cannot be replied to
    await app.page.opensSession("Keep going");
    // AND the status bar names the workspace that needs a look
    await expectPageToShow(app, "so this session is read-only", `${app.host.alias} offline`);
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);

test(
  "restarting a busy old relay asks first, and only then replaces it",
  async () => {
    // ********************************************************************
    // ** GIVEN a workspace that needs a relay update because the old relay's agent is working
    // ********************************************************************
    const app = await startSshAppInBrowser();
    const old = await startOldRelayOnHost(app.host, "0.0.1");
    await old.startsWorkingSession();
    const workspace = await app.ssh.addsTheHost();
    await app.page.opensTheWorkspaceMenu();
    await expectWorkspaceRowToSay(app, { workspace: app.host.alias, text: "Needs relay update" });

    // ********************************************************************
    // ** WHEN the user presses Restart relay
    // ********************************************************************
    await app.page.restartsTheRelayOf(app.host.alias);

    // ********************************************************************
    // ** THEN it warns that running sessions stop, and the workspace is not restarted yet
    // ********************************************************************
    const question = "Restart the relay?";
    await expectConfirmationToSay(app, { title: question, text: "stops every session" });
    await expectWorkspaceListedAs(app, { workspace, state: "needs-relay-update" });
    // AND after the user confirms, the workspace connects to a relay of the app's version
    await app.page.confirms(question, "Restart relay");
    await expectWorkspaceRowToSay(app, { workspace: app.host.alias, text: "Connected" });
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);

test(
  "removing a workspace keeps its sessions readable under Removed",
  async () => {
    // ********************************************************************
    // ** GIVEN an ssh workspace with a session
    // ********************************************************************
    const { app } = await startSshAppWithASession("Old remote work");
    await app.page.opensTheWorkspaceMenu();

    // ********************************************************************
    // ** WHEN the user removes the workspace and confirms
    // ********************************************************************
    await app.page.removesTheWorkspace(app.host.alias);
    const question = "Remove this workspace?";
    await expectConfirmationToSay(app, { title: question, text: "stay readable" });
    await app.page.confirms(question, "Remove workspace");
    await app.page.closesTheDialog();

    // ********************************************************************
    // ** THEN the session is listed under Removed, still readable
    // ********************************************************************
    await expectWorkspaceGroupToShow(app, {
      workspace: "Removed",
      texts: ["Old remote work", `from ${app.host.alias}`, "read-only"],
    });
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);
