import { afterEach, test } from "bun:test";
import {
  expectBrowserToOpenTheApp,
  expectNoBrowserToOpen,
} from "../support/expect/dev-command-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aDeveloper } from "../support/setup/dev-command.ts";

afterEach(cleanUpAfterTest);

test("bun dev opens the browser on the app when it has started", async () => {
  // ********************************************************************
  // ** GIVEN a developer who has not asked for the browser to stay closed
  // ********************************************************************
  const developer = aDeveloper({ noOpen: false });

  // ********************************************************************
  // ** WHEN they run `bun dev`
  // ********************************************************************
  const dev = await developer.runsBunDev();

  // ********************************************************************
  // ** THEN the browser is asked to open the address the app listens on
  // ********************************************************************
  await expectBrowserToOpenTheApp(dev);
});

test("bun dev leaves the browser closed when AGENTCONTROL_NO_OPEN is set", async () => {
  // ********************************************************************
  // ** GIVEN a developer who set AGENTCONTROL_NO_OPEN
  // ********************************************************************
  const developer = aDeveloper({ noOpen: true });

  // ********************************************************************
  // ** WHEN they run `bun dev`
  // ********************************************************************
  const dev = await developer.runsBunDev();

  // ********************************************************************
  // ** THEN it says it opens no browser, and none is opened
  // ********************************************************************
  await expectNoBrowserToOpen(dev);
});
