import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";

const mockAgent = JSON.stringify(["bun", join(import.meta.dir, "../mock-agent/main.ts")]);

/** The environment of a machine where Claude Code and Codex both start and answer like the mock agent. */
export const machineWithAgentsThatStart = {
  AGENTCONTROL_AGENT_CLAUDE_CODE_CMD: mockAgent,
  AGENTCONTROL_AGENT_CODEX_CMD: mockAgent,
};

/** The environment of a machine where Codex is installed but dies as soon as it is started. */
export const machineWhereCodexCannotStart = {
  ...machineWithAgentsThatStart,
  AGENTCONTROL_AGENT_CODEX_CMD: JSON.stringify(["false"]),
};

/** The environment of a machine where Codex starts but never answers, and checks give up after 300 ms. */
export const machineWhereCodexNeverAnswers = {
  ...machineWithAgentsThatStart,
  AGENTCONTROL_AGENT_CODEX_CMD: JSON.stringify(["sleep", "5"]),
  AGENTCONTROL_AGENT_CHECK_TIMEOUT_MS: "300",
};

/** The environment of a machine where git cannot be found. */
export const machineWithoutGit = { PATH: "/nonexistent" };

/** The environment of a machine whose home folder cannot be read, so its free space is unknown. */
export const machineWithUnreadableHome = { HOME: "/nonexistent-home-folder" };

/** The environment of a machine whose git is version 2.10, older than the app needs. */
export async function machineWithOldGit(): Promise<Record<string, string>> {
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-old-git-"));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  await Bun.write(join(folder, "git"), '#!/bin/sh\necho "git version 2.10.0"\n');
  await chmod(join(folder, "git"), 0o755);
  return { PATH: folder };
}

/** The environment of a machine where git has no user name or email configured. */
export const machineWithoutGitIdentity = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};
