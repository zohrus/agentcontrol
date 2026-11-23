import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectCodeServerOnlyOnAPrivateSocket } from "../support/expect/ide-access-expectations.ts";
import {
  expectOneCodeServerStarted,
  expectSocketToEchoText,
  expectWorkbenchOnTheWorktreeOf,
} from "../support/expect/ide-expectations.ts";
import {
  expectCodeServerRanOnTheHost,
  expectNoCodeServerOnThisMachine,
} from "../support/expect/ide-host-expectations.ts";
import { expectDownloadToArriveWhole } from "../support/expect/ide-transfer-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startsDownload } from "../support/setup/ide-downloads.ts";
import { opensBrowserVsCode } from "../support/setup/ide-user.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

async function startsSessionOnTheHost() {
  const { app, host, user } = await startAppWithSshHost({ codeServer: true });
  const workspace = await user.addsTheHost();
  host.mockAgent.willReply("Done");
  const session = await user.startsSessionOn(workspace, { prompt: "Work on the host" });
  return { app, host, session };
}

test("the browser VS Code of a session on an ssh host runs on that host, on the session's worktree there", async () => {
  // ********************************************************************
  // ** GIVEN a session on an ssh workspace whose host has code-server
  // ********************************************************************
  const { app, host, session } = await startsSessionOnTheHost();

  // ********************************************************************
  // ** WHEN the user opens it in the browser VS Code
  // ********************************************************************
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** THEN the page shows the worktree on the host, and the host's relay started code-server
  // ********************************************************************
  await expectWorkbenchOnTheWorktreeOf({ app, tab }, session);
  await expectCodeServerRanOnTheHost(host);
  // AND nothing was started on this machine
  await expectNoCodeServerOnThisMachine(app);
});

test("the host's code-server listens on a private socket and opens no port", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session on an ssh host is open
  // ********************************************************************
  const { app, host, session } = await startsSessionOnTheHost();
  await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the flags and the socket's permissions on the host are read
  // ********************************************************************
  const running = await expectOneCodeServerStarted(host.relayDataDir);

  // ********************************************************************
  // ** THEN it listens on a private unix socket only
  // ********************************************************************
  await expectCodeServerOnlyOnAPrivateSocket(host.relayDataDir, running);
});

test("a WebSocket to the host's code-server travels over the ssh connection", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session on an ssh host is open
  // ********************************************************************
  const { app, session } = await startsSessionOnTheHost();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the workbench opens a WebSocket and sends a message
  // ********************************************************************
  const socket = tab.opensSocket("socket");

  // ********************************************************************
  // ** THEN the message comes back
  // ********************************************************************
  await expectSocketToEchoText(socket, "over ssh");
  socket.closes();
});

test("a big download from the host's code-server arrives whole over the ssh connection", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session on an ssh host is open
  // ********************************************************************
  const { app, session } = await startsSessionOnTheHost();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page downloads 20 MB
  // ********************************************************************
  const download = startsDownload(tab, 20);
  await download.paused;

  // ********************************************************************
  // ** THEN all of it arrives, unchanged
  // ********************************************************************
  await expectDownloadToArriveWhole(download, 20);
});
