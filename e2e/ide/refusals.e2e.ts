import { afterEach, setDefaultTimeout, test } from "bun:test";
import {
  expectIdeToAnswer,
  expectSocketToBeRefused,
  expectSocketToEchoText,
  expectSocketToEndWith,
} from "../support/expect/ide-expectations.ts";
import {
  expectBigUploadToBeRefused,
  expectOpeningToFailBecause,
} from "../support/expect/ide-refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithCodeServer } from "../support/setup/ide-setups.ts";
import { opensBrowserVsCode } from "../support/setup/ide-user.ts";

setDefaultTimeout(30_000);
afterEach(cleanUpAfterTest);

test("an upload over 16 MiB is refused", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page posts 17 MiB
  // ********************************************************************
  // ********************************************************************
  // ** THEN the answer is 413
  // ********************************************************************
  await expectBigUploadToBeRefused(tab);
});

test("a tab of a workspace that went offline is told why, not left waiting", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the workspace's relay stops and the tab asks for a page
  // ********************************************************************
  await app.theRelayStops();

  // ********************************************************************
  // ** THEN the answer is 503 (the workspace is not connected)
  // ********************************************************************
  await expectIdeToAnswer(tab, { path: "", status: 503 });
});

test("a code-server that cannot start is reported with what it said", async () => {
  // ********************************************************************
  // ** GIVEN a workspace whose code-server exits as soon as it starts
  // ********************************************************************
  const relayEnv = { FAKE_CODE_SERVER_FAILS: "1" };
  const { app, session } = await startAppWithCodeServer({ relayEnv });

  // ********************************************************************
  // ** WHEN the user opens the browser VS Code
  // ********************************************************************
  // ********************************************************************
  // ** THEN opening fails and says what code-server printed
  // ********************************************************************
  await expectOpeningToFailBecause({ app, session }, "cannot start");
});

test("when code-server closes a WebSocket the page's socket closes with the same code", async () => {
  // ********************************************************************
  // ** GIVEN the workbench holds an open WebSocket
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const socket = (await opensBrowserVsCode(app, session)).opensSocket("socket");
  await expectSocketToEchoText(socket, "hello");

  // ********************************************************************
  // ** WHEN code-server closes it with code 4001
  // ********************************************************************
  socket.sendsText("close-now");

  // ********************************************************************
  // ** THEN the page's socket ends with 4001
  // ********************************************************************
  await expectSocketToEndWith(socket, 4001);
});

test("a WebSocket code-server refuses is refused to the page too", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the workbench opens a WebSocket on a path code-server does not accept
  // ********************************************************************
  const socket = tab.opensSocket("refuse");

  // ********************************************************************
  // ** THEN the page's socket is refused
  // ********************************************************************
  await expectSocketToBeRefused(socket);
});

test("an open WebSocket ends when the workspace's relay stops", async () => {
  // ********************************************************************
  // ** GIVEN the workbench holds an open WebSocket
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const socket = (await opensBrowserVsCode(app, session)).opensSocket("socket");
  await expectSocketToEchoText(socket, "hello");

  // ********************************************************************
  // ** WHEN the relay stops
  // ********************************************************************
  await app.theRelayStops();

  // ********************************************************************
  // ** THEN the page's socket ends (code-server was stopped with the relay)
  // ********************************************************************
  await socket.endings.waitFor(() => true, "expected the WebSocket to end");
});
