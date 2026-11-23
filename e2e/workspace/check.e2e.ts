import { afterEach, test } from "bun:test";
import {
  expectChecklistStep,
  expectGitToBeAvailable,
} from "../support/expect/workspace-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  machineWhereCodexCannotStart,
  machineWhereCodexNeverAnswers,
  machineWithAgentsThatStart,
  machineWithoutGit,
  machineWithoutGitIdentity,
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

test("the workspace check starts each agent and says its ACP handshake worked", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine where Claude Code and Codex start
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: machineWithAgentsThatStart });

  // ********************************************************************
  // ** WHEN the user runs the workspace check with the agents
  // ********************************************************************
  const check = await relay.user.checksTheWorkspaceAndItsAgents();

  // ********************************************************************
  // ** THEN the checklist says each agent's handshake worked
  // ********************************************************************
  expectChecklistStep(check, { id: "agent-claude-code", status: "ok", saying: "handshake worked" });
  expectChecklistStep(check, { id: "agent-codex", status: "ok", saying: "handshake worked" });
});

test("the workspace check says an agent could not be started", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine where Codex dies as soon as it is started
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: machineWhereCodexCannotStart });

  // ********************************************************************
  // ** WHEN the user runs the workspace check with the agents
  // ********************************************************************
  const check = await relay.user.checksTheWorkspaceAndItsAgents();

  // ********************************************************************
  // ** THEN the checklist says Codex could not be started
  // ********************************************************************
  expectChecklistStep(check, { id: "agent-codex", status: "failed", saying: "Could not start" });
  // AND the agent that works is still reported as working
  expectChecklistStep(check, { id: "agent-claude-code", status: "ok", saying: "handshake worked" });
});

test("the workspace check gives up on an agent that does not answer", async () => {
  // ********************************************************************
  // ** GIVEN the relay is running on a machine where Codex starts but never answers
  // ********************************************************************
  const relay = await startRelayWithLocalRepo({ env: machineWhereCodexNeverAnswers });

  // ********************************************************************
  // ** WHEN the user runs the workspace check with the agents
  // ********************************************************************
  const check = await relay.user.checksTheWorkspaceAndItsAgents();

  // ********************************************************************
  // ** THEN the checklist says Codex did not answer in time
  // ********************************************************************
  expectChecklistStep(check, { id: "agent-codex", status: "failed", saying: "did not answer" });
});
