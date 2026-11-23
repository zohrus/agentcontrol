import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectProductionToStallBelow } from "../support/expect/ide-expectations.ts";
import {
  expectDownloadToArriveWhole,
  expectEchoToReturnTheUpload,
} from "../support/expect/ide-transfer-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startsDownload } from "../support/setup/ide-downloads.ts";
import { startAppWithCodeServer } from "../support/setup/ide-setups.ts";
import { opensBrowserVsCode } from "../support/setup/ide-user.ts";

setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("a big download arrives whole and unchanged", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page downloads 40 MB that code-server streams
  // ********************************************************************
  const download = startsDownload(tab, 40);
  await download.paused;

  // ********************************************************************
  // ** THEN all 40 MB arrive, byte for byte
  // ********************************************************************
  await expectDownloadToArriveWhole(download, 40);
});

test("a download nobody reads is held back instead of piling up in memory", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page starts a 512 MB download and reads only its first piece
  // ********************************************************************
  const download = startsDownload(tab, 512);
  await download.paused;

  // ********************************************************************
  // ** THEN code-server is held back well below that: the relay and the app wait for the reader
  // ********************************************************************
  await expectProductionToStallBelow(tab, 16);
  download.givesUp();
});

test("closing the tab in the middle of a download stops code-server producing it", async () => {
  // ********************************************************************
  // ** GIVEN a 512 MB download is in progress and the page has read its first piece
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);
  const download = startsDownload(tab, 512);
  await download.paused;

  // ********************************************************************
  // ** WHEN the tab is closed
  // ********************************************************************
  download.givesUp();

  // ********************************************************************
  // ** THEN code-server stops producing it, far below the full 512 MB
  // ********************************************************************
  await expectProductionToStallBelow(tab, 16);
});

test("a large upload reaches code-server unchanged", async () => {
  // ********************************************************************
  // ** GIVEN the browser VS Code of a session is open
  // ********************************************************************
  const { app, session } = await startAppWithCodeServer();
  const tab = await opensBrowserVsCode(app, session);

  // ********************************************************************
  // ** WHEN the page posts 6 MB of bytes to a path that echoes them
  // ********************************************************************
  // ********************************************************************
  // ** THEN the same bytes come back
  // ********************************************************************
  await expectEchoToReturnTheUpload(tab, 6 * 1024 * 1024);
});
