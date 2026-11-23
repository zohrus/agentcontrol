import { afterEach, setDefaultTimeout, test } from "bun:test";
import {
  expectCodeServersStarted,
  expectIdeToAnswer,
  expectOneCodeServerStarted,
} from "../support/expect/ide-expectations.ts";
import {
  expectCodeServerToBeGone,
  expectCodeServerToKeepRunning,
  expectOneCodeServerPerWorktree,
  expectSharedSettingsAndExtensions,
} from "../support/expect/ide-process-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { relayDataOf, startAppWithCodeServer } from "../support/setup/ide-setups.ts";
import { opensBrowserVsCode } from "../support/setup/ide-user.ts";
import { startsSessionThatFinished } from "../support/setup/preview-sessions.ts";

setDefaultTimeout(30_000);
afterEach(cleanUpAfterTest);

test("two sessions get two code-servers, each on its own worktree", async () => {
  // ********************************************************************
  // ** GIVEN two sessions on a workspace where code-server is installed
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const other = await startsSessionThatFinished(app, "Add logging");

  // ********************************************************************
  // ** WHEN the user opens both in the browser VS Code
  // ********************************************************************
  await opensBrowserVsCode(app, session);
  await opensBrowserVsCode(app, other);

  // ********************************************************************
  // ** THEN two code-servers run, one on each session's worktree
  // ********************************************************************
  await expectOneCodeServerPerWorktree({ app, relayDataDir: relayDataOf(app) }, [session, other]);
});

test("opening the same session twice does not start a second code-server", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const first = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the user opens it again
  // ********************************************************************
  const second = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** THEN it is the same address and still one code-server
  // ********************************************************************
  await expectCodeServersStarted(relayDataOf(app), 1);
  await expectIdeToAnswer(second, { path: "", status: 200 });
  if (first.url !== second.url) throw new Error("expected the same address both times");
});

test("every code-server of a workspace shares its settings and extensions folders", async () => {
  // ********************************************************************
  // ** GIVEN two sessions whose browser VS Code is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const other = await startsSessionThatFinished(app, "Add logging");
  await opensBrowserVsCode(app, session);
  await opensBrowserVsCode(app, other);

  // ********************************************************************
  // ** WHEN the two code-servers' command lines are read
  // ********************************************************************
  const started = await expectCodeServersStarted(relayDataOf(app), 2);

  // ********************************************************************
  // ** THEN both use the workspace's folders, so installed extensions survive across sessions
  // ********************************************************************
  expectSharedSettingsAndExtensions(relayDataOf(app), started);
});

test("archiving a session ends its code-server and everything it started", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  await opensBrowserVsCode(app, session);
  const running = await expectOneCodeServerStarted(relayDataOf(app));

  // ********************************************************************
  // ** WHEN the session is archived
  // ********************************************************************
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** THEN the code-server process and the process it started are gone
  // ********************************************************************
  await expectCodeServerToBeGone(running);
});

test("an address of an archived session stops working", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the session is archived
  // ********************************************************************
  await app.user.archivesSession(session, { force: true });

  // ********************************************************************
  // ** THEN the address is refused
  // ********************************************************************
  await expectIdeToAnswer(tab, { path: "", status: 404 });
});

test("stopping the relay ends the code-server", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  await opensBrowserVsCode(app, session);
  const running = await expectOneCodeServerStarted(relayDataOf(app));

  // ********************************************************************
  // ** WHEN the relay stops
  // ********************************************************************
  await app.theRelayStops();

  // ********************************************************************
  // ** THEN the code-server and the process it started are gone
  // ********************************************************************
  await expectCodeServerToBeGone(running);
});

test("a code-server nobody connects to ends after the idle time", async () => {
  // ********************************************************************
  // ** GIVEN a relay that ends idle code-servers after 300 ms, and one is running
  // ********************************************************************
  const relayEnv = { AGENTCONTROL_IDE_IDLE_MS: "300" };
  const { app, session } = await startAppWithCodeServer({ relayEnv });
  const tab = await opensBrowserVsCode(app, session);
  await expectIdeToAnswer(tab, { path: "", status: 200 });
  const running = await expectOneCodeServerStarted(relayDataOf(app));

  // ********************************************************************
  // ** WHEN no request or WebSocket is open for that long
  // ********************************************************************
  // ********************************************************************
  // ** THEN the code-server ends
  // ********************************************************************
  await expectCodeServerToBeGone(running);
});

test("a code-server with a WebSocket open is not ended as idle", async () => {
  // ********************************************************************
  // ** GIVEN the idle time is 300 ms, and the workbench holds a WebSocket open
  // ********************************************************************
  const relayEnv = { AGENTCONTROL_IDE_IDLE_MS: "300" };
  const { app, session } = await startAppWithCodeServer({ relayEnv });
  const tab = await opensBrowserVsCode(app, session);
  const socket = tab.opensSocket("socket");
  await socket.openings.waitFor(() => true, "expected the WebSocket to open");
  const running = await expectOneCodeServerStarted(relayDataOf(app));

  // ********************************************************************
  // ** WHEN four times the idle time passes
  // ********************************************************************
  // ********************************************************************
  // ** THEN the code-server still runs
  // ********************************************************************
  await expectCodeServerToKeepRunning(running, 1200);
  socket.closes();
});

test("a tab left open starts the code-server again with its next request after it ended as idle", async () => {
  // ********************************************************************
  // ** GIVEN a code-server that ended as idle (300 ms)
  // ********************************************************************
  const relayEnv = { AGENTCONTROL_IDE_IDLE_MS: "300" };
  const { app, session } = await startAppWithCodeServer({ relayEnv });
  const tab = await opensBrowserVsCode(app, session);
  const first = await expectOneCodeServerStarted(relayDataOf(app));
  await expectCodeServerToBeGone(first);

  // ********************************************************************
  // ** WHEN the tab asks for a page again
  // ********************************************************************
  // ********************************************************************
  // ** THEN a new code-server starts and answers
  // ********************************************************************
  await expectIdeToAnswer(tab, { path: "", status: 200 });
  await expectCodeServersStarted(relayDataOf(app), 2);
});
