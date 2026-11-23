import { afterEach, test } from "bun:test";
import {
  expectIdeFileToContain,
  expectSocketToEchoBytes,
  expectSocketToEchoText,
  expectSocketToUseSubprotocol,
  expectWorkbenchOnTheWorktreeOf,
} from "../support/expect/ide-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithCodeServer } from "../support/setup/ide-setups.ts";
import { opensBrowserVsCode } from "../support/setup/ide-user.ts";

afterEach(cleanUpAfterTest);

test("the browser VS Code of a session shows that session's worktree", async () => {
  // ********************************************************************
  // ** GIVEN a session on a workspace where code-server is installed
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();

  // ********************************************************************
  // ** WHEN the user opens it in the browser VS Code
  // ********************************************************************
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** THEN the page that comes back is code-server's, opened on the session's worktree
  // ********************************************************************
  await expectWorkbenchOnTheWorktreeOf({ app, tab }, session);
});

test("files the workbench page asks for next load through the same address", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page loads its script
  // ********************************************************************
  // ********************************************************************
  // ** THEN the script arrives
  // ********************************************************************
  await expectIdeFileToContain(tab, { path: "static/app.js", text: "workbench loaded" });
});

test("a WebSocket opened by the workbench carries text and binary messages both ways", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the workbench opens a WebSocket and sends a text message
  // ********************************************************************
  const socket = tab.opensSocket("socket");

  // ********************************************************************
  // ** THEN the text comes back, and so do binary bytes sent next
  // ********************************************************************
  await expectSocketToEchoText(socket, "hello from the workbench");
  // AND binary data is not changed on the way
  await expectSocketToEchoBytes(socket, [0, 1, 2, 254, 255]);
  socket.closes();
});

test("the subprotocol a WebSocket asks for is the one code-server answers with", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the workbench opens a WebSocket offering the subprotocol "vscode"
  // ********************************************************************
  const socket = tab.opensSocket("socket", { protocols: ["vscode"] });

  // ********************************************************************
  // ** THEN the socket is opened with that subprotocol
  // ********************************************************************
  await expectSocketToUseSubprotocol(socket, "vscode");
  socket.closes();
});
