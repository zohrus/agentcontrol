import { join } from "node:path";
import { afterEach, test } from "bun:test";
import {
  expectOutputToHaveBeenCutShort,
  expectTheEndOfTheOutputToHaveArrived,
} from "../support/expect/terminal-flood-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { readsTheTerminalOnlyAfterTheShellFinishes } from "../support/setup/slow-browser-reader.ts";
import { readsTerminalOutputOnlyAfterTheShellFinishes } from "../support/setup/slow-terminal-reader.ts";
import { SHELL_RELAY_ENV, startAppWithASession } from "../support/setup/start-app-with-shell.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

const ONE_HUNDRED_MEGABYTES = 100_000_000;

const floodCommand = (doneFile: string): string =>
  `head -c ${String(ONE_HUNDRED_MEGABYTES)} /dev/zero | tr '\\0' y; echo flood-over; touch ${doneFile}`;

test("a shell that prints far more than anyone reads does not fill the relay's memory", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open on a program that does not read for now
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: SHELL_RELAY_ENV });
  const session = await relay.user.startsSession({ prompt: "Add rate limiting" });
  const doneFile = join(relay.dataDir, "flood-done");

  // ********************************************************************
  // ** WHEN the shell prints 100 MB, and only then does the program read
  // ********************************************************************
  const command = floodCommand(doneFile);
  const reading = await readsTerminalOutputOnlyAfterTheShellFinishes(relay, {
    session,
    command,
    doneFile,
  });

  // ********************************************************************
  // ** THEN the relay dropped most of the output and said so
  // ********************************************************************
  expectOutputToHaveBeenCutShort(reading, { printed: ONE_HUNDRED_MEGABYTES });
  // AND the end of the output, after the dropped part, still arrived
  expectTheEndOfTheOutputToHaveArrived(reading, "flood-over");
});

test("a shell that prints far more than the browser reads does not fill the app's memory", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open in a browser that does not read for now
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const doneFile = join(app.dataDir, "flood-done");

  // ********************************************************************
  // ** WHEN the shell prints 100 MB, and only then does the browser read
  // ********************************************************************
  const command = floodCommand(doneFile);
  const reading = await readsTheTerminalOnlyAfterTheShellFinishes(app, {
    session,
    command,
    doneFile,
  });

  // ********************************************************************
  // ** THEN the app dropped most of the output and said so
  // ********************************************************************
  expectOutputToHaveBeenCutShort(reading, { printed: ONE_HUNDRED_MEGABYTES });
  // AND the end of the output, after the dropped part, still arrived
  expectTheEndOfTheOutputToHaveArrived(reading, "flood-over");
});
