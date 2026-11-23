import { afterEach, test } from "bun:test";
import {
  expectChecklistStep,
  expectGitToBeAvailable,
} from "../support/expect/workspace-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  machineWithOldGit,
  machineWithoutGit,
  machineWithoutGitIdentity,
  machineWithUnreadableHome,
} from "../support/setup/machines.ts";
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

test("the workspace check says git is not installed and skips the identity step", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine where git cannot be found
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: machineWithoutGit });

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const check = await relay.user.checksTheWorkspace();

  // ********************************************************************
  // ** THEN the checklist says git is not installed
  // ********************************************************************
  expectChecklistStep(check, { id: "git", status: "failed", saying: "not installed" });
  // AND the git identity step is skipped
  expectChecklistStep(check, { id: "gitIdentity", status: "skipped", saying: "not available" });
});

test("the workspace check asks the user to set their git name and email", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine where git has no name or email
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: machineWithoutGitIdentity });

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const check = await relay.user.checksTheWorkspace();

  // ********************************************************************
  // ** THEN the checklist asks the user to set their name and email
  // ********************************************************************
  expectChecklistStep(check, { id: "gitIdentity", status: "failed", saying: "Set your name" });
});

test("the workspace check says an old git is too old and skips the identity step", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine with git 2.10 installed
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: await machineWithOldGit() });

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const check = await relay.user.checksTheWorkspace();

  // ********************************************************************
  // ** THEN the checklist says git is too old
  // ********************************************************************
  expectChecklistStep(check, { id: "git", status: "failed", saying: "too old" });
  // AND the git identity step is skipped
  expectChecklistStep(check, { id: "gitIdentity", status: "skipped", saying: "not available" });
});

test("the workspace check says when the free disk space cannot be read", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine whose home folder cannot be read
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: machineWithUnreadableHome });

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const check = await relay.user.checksTheWorkspace();

  // ********************************************************************
  // ** THEN the checklist says the free disk space could not be read
  // ********************************************************************
  expectChecklistStep(check, { id: "disk", status: "failed", saying: "Could not read" });
});
