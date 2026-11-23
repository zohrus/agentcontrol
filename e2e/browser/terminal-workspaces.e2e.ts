import { afterEach, test } from "bun:test";
import { expectPageToShow } from "../support/browser/page-expectations.ts";
import {
  expectTerminalToShowAPrompt,
  expectTerminalToShowLine,
} from "../support/browser/terminal-expectations.ts";
import { startSshAppWithASession } from "../support/browser/workspaces-setups.ts";
import { expectWorkspaceListedAs } from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

// Every ssh call is a real handshake.
const SSH_BROWSER_TEST_TIMEOUT_MS = 90_000;

afterEach(cleanUpAfterTest);

test(
  "the Terminal tab of a session on an ssh workspace runs a shell on that host",
  async () => {
    // ********************************************************************
    // ** GIVEN a session on an ssh workspace, open in the browser
    // ********************************************************************
    const { app } = await startSshAppWithASession("Work on the host");
    await app.page.opensSession("Work on the host");

    // ********************************************************************
    // ** WHEN the user opens the Terminal tab and asks for the shell's home folder
    // ********************************************************************
    await app.page.opensTerminalTab();
    await expectTerminalToShowAPrompt(app);
    await app.page.typesInTerminal("echo here=$(pwd | tr '/' x)");

    // ********************************************************************
    // ** THEN the answer comes from the host (the session's folder is not on this Mac)
    // ********************************************************************
    await expectTerminalToShowLine(app, "here=x.*");
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a session of an offline workspace explains that it is read-only instead of offering a terminal",
  async () => {
    // ********************************************************************
    // ** GIVEN a session on an ssh workspace that has gone offline
    // ********************************************************************
    const { app, workspace } = await startSshAppWithASession("Work on the host");
    app.host.network.goesDown();
    await expectWorkspaceListedAs(app, { workspace, state: "offline" });

    // ********************************************************************
    // ** WHEN the user opens the session
    // ********************************************************************
    await app.page.opensSession("Work on the host");

    // ********************************************************************
    // ** THEN the right-hand panel says the workspace is offline and the session read-only
    // ********************************************************************
    await expectPageToShow(app, "is offline, so its sessions are read-only");
  },
  SSH_BROWSER_TEST_TIMEOUT_MS,
);
