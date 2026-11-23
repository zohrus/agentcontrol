import { afterEach, test } from "bun:test";
import {
  expectBrowserToOpenTheApp,
  expectNoBrowserToOpen,
} from "../support/expect/dev-command-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startDevCommand } from "../support/setup/dev-command.ts";

afterEach(cleanUpAfterTest);

test("bun dev opens the browser on the app when it has started", async () => {
  // ********************************************************************
  // ** GIVEN a developer who has not asked for the browser to stay closed
  // ********************************************************************
  // WHEN they run `bun dev`
  const dev = await startDevCommand({ noOpen: false });

  // ********************************************************************
  // ** THEN the browser is asked to open the address the app listens on
  // ********************************************************************
  await expectBrowserToOpenTheApp(dev);
});

test("bun dev leaves the browser closed when AGENTCONTROL_NO_OPEN is set", async () => {
  // ********************************************************************
  // ** GIVEN a developer who set AGENTCONTROL_NO_OPEN
  // ********************************************************************
  // WHEN they run `bun dev`
  const dev = await startDevCommand({ noOpen: true });

  // ********************************************************************
  // ** THEN no browser is opened
  // ********************************************************************
  await expectNoBrowserToOpen(dev);
});
