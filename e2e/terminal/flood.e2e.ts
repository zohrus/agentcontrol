import { join } from "node:path";
import { afterEach, test } from "bun:test";
import {
  expectOutputToHaveBeenCutShort,
  expectTheCutToBeShownAfterTheLastOutput,
  expectTheQuietTerminalToHaveShownEverything,
  expectTheEndOfTheOutputToHaveArrived,
} from "../support/expect/terminal-flood-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayWithASessionToFlood } from "../support/setup/flood-relay.ts";
import { readsTheTerminalOnlyAfterTheShellFinishes } from "../support/setup/slow-browser-reader.ts";
import {
  readsASecondTerminalWhileTheFirstOneFloods,
  readsTerminalOutputOnlyAfterTheShellFinishes,
} from "../support/setup/slow-terminal-reader.ts";
import { SHELL_RELAY_ENV, startAppWithASession } from "../support/setup/start-app-with-shell.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

const ONE_HUNDRED_MEGABYTES = 100_000_000;
const A_SCREENFUL = 100_000;

const floodCommand = (doneFile: string): string =>
  `head -c ${String(ONE_HUNDRED_MEGABYTES)} /dev/zero | tr '\\0' y; echo flood-over; touch ${doneFile}`;

const floodThenExitCommand = (doneFile: string): string =>
  `head -c ${String(ONE_HUNDRED_MEGABYTES)} /dev/zero | tr '\\0' y; touch ${doneFile}; exit`;

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

test("a shell that ends in the middle of a flood still says that output was skipped", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open on a program that does not read for now
  // ********************************************************************
  const { relay, session, doneFile } = await aRelayWithASessionToFlood();

  // ********************************************************************
  // ** WHEN the shell prints 100 MB and ends with nothing printed after it
  // ********************************************************************
  const command = floodThenExitCommand(doneFile);
  const reading = await readsTerminalOutputOnlyAfterTheShellFinishes(relay, {
    session,
    command,
    doneFile,
  });

  // ********************************************************************
  // ** THEN the output says where it was cut, before the shell's end
  // ********************************************************************
  expectTheCutToBeShownAfterTheLastOutput(reading);
});

test("a shell that ends in the middle of a flood shows the browser that output was skipped", async () => {
  // ********************************************************************
  // ** GIVEN a session with its terminal open in a browser that does not read for now
  // ********************************************************************
  const { app, session } = await startAppWithASession();
  const doneFile = join(app.dataDir, "flood-done");

  // ********************************************************************
  // ** WHEN the shell prints 100 MB and ends with nothing printed after it
  // ********************************************************************
  const command = floodThenExitCommand(doneFile);
  const reading = await readsTheTerminalOnlyAfterTheShellFinishes(app, {
    session,
    command,
    doneFile,
  });

  // ********************************************************************
  // ** THEN the output says where it was cut, before the shell's end
  // ********************************************************************
  expectTheCutToBeShownAfterTheLastOutput(reading);
});

test("a flood in one terminal does not drop what another terminal prints", async () => {
  // ********************************************************************
  // ** GIVEN a session with two terminals open on one connection that does not read for now
  // ********************************************************************
  const { relay, session, doneFile: floodDone } = await aRelayWithASessionToFlood();
  const flood = { command: floodCommand(floodDone), doneFile: floodDone };
  const quietDone = join(relay.dataDir, "quiet-done");
  const quiet = {
    command: `head -c ${String(A_SCREENFUL)} /dev/zero | tr '\\0' z; touch ${quietDone}`,
    doneFile: quietDone,
  };

  // ********************************************************************
  // ** WHEN the first shell floods 100 MB and the second prints a screenful, and only then is it read
  // ********************************************************************
  const reading = await readsASecondTerminalWhileTheFirstOneFloods(relay, {
    session,
    flood,
    quiet,
  });

  // ********************************************************************
  // ** THEN the second terminal shows everything it printed
  // ********************************************************************
  expectTheQuietTerminalToHaveShownEverything(reading, { letter: "z", printed: A_SCREENFUL });
});
