import { afterEach, test } from "bun:test";
import { expectGitToBeAvailable } from "../support/expect/workspace-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("the workspace check reports git as available", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine with git installed
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const check = await relay.user.checksTheWorkspace();

  // ********************************************************************
  // ** THEN the checklist says git is available
  // ********************************************************************
  expectGitToBeAvailable(check);
});
