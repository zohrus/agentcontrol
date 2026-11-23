import { afterEach, test } from "bun:test";
import {
  expectProcessToBeGone,
  expectStopToFailSaying,
  expectStopToSucceedSaying,
} from "../support/expect/daemon-stop-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  aRelayFolder,
  aRelayRunsIn,
  aRelayThatIgnoresStopRunsIn,
} from "../support/setup/daemon-process.ts";

afterEach(cleanUpAfterTest);

test("the stop command stops the relay in the folder and says so", async () => {
  // ********************************************************************
  // ** GIVEN a relay running in a data folder
  // ********************************************************************
  const folder = await aRelayFolder();
  const pid = await aRelayRunsIn(folder);

  // ********************************************************************
  // ** WHEN the user runs the stop command for that folder
  // ********************************************************************
  const ended = await folder.stopsIt();

  // ********************************************************************
  // ** THEN it says it stopped the relay, exits well, and the relay is gone
  // ********************************************************************
  expectStopToSucceedSaying(ended, "Stopped the relay");
  await expectProcessToBeGone(folder, pid);
});

test("the stop command says when no relay runs in the folder", async () => {
  // ********************************************************************
  // ** GIVEN a data folder in which no relay runs
  // ********************************************************************
  const folder = await aRelayFolder();

  // ********************************************************************
  // ** WHEN the user runs the stop command for it
  // ********************************************************************
  const ended = await folder.stopsIt();

  // ********************************************************************
  // ** THEN it says there is no relay there instead of printing nothing
  // ********************************************************************
  expectStopToSucceedSaying(ended, "No relay is running");
});

test("the stop command exits with an error when the relay does not stop", async () => {
  // ********************************************************************
  // ** GIVEN a relay that ignores the request to stop
  // ********************************************************************
  const folder = await aRelayFolder();
  await aRelayThatIgnoresStopRunsIn(folder);

  // ********************************************************************
  // ** WHEN the user runs the stop command
  // ********************************************************************
  const ended = await folder.stopsIt();

  // ********************************************************************
  // ** THEN it says the relay still runs and exits with an error
  // ********************************************************************
  expectStopToFailSaying(ended, "still runs");
});
