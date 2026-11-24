import { afterEach, test } from "bun:test";
import { expectPidFileToName } from "../support/expect/relay-overlap-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayFolder, aRelayRunsIn, aRelayStartsIn } from "../support/setup/daemon-process.ts";
import {
  connectsToTheRelayInTheFolder,
  waitsUntilTheRelayTakesNoMoreClients,
} from "../support/setup/relay-overlap.ts";
import { connectsAClientThatNeverHangsUp } from "../support/setup/stuck-client.ts";

afterEach(cleanUpAfterTest);

test("a relay that starts while the old one is still stopping keeps its socket and pid file", async () => {
  // ********************************************************************
  // ** GIVEN a relay that needs a second to stop, because a client does not hang up on it
  // ********************************************************************
  const folder = await aRelayFolder();
  await aRelayRunsIn(folder);
  await connectsAClientThatNeverHangsUp(folder);

  // ********************************************************************
  // ** WHEN the user stops it and a new relay is started before it is gone
  // ********************************************************************
  const stopping = folder.stopsIt();
  await waitsUntilTheRelayTakesNoMoreClients(folder);
  const newPid = aRelayStartsIn(folder);
  await stopping;

  // ********************************************************************
  // ** THEN the new relay answers on the folder's socket, and its pid file names it
  // ********************************************************************
  const { pidFile } = await connectsToTheRelayInTheFolder(folder);
  expectPidFileToName({ pidFile, pid: newPid, who: "the new relay" });
});
