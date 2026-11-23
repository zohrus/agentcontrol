// The smoke step that runs a session with the mock agent through the compiled app and relay.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callApi, waitUntil } from "./api.ts";
import type { SmokeApp } from "./app-process.ts";
import { expect, writeScript } from "./check.ts";

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" };

/** A git repository with one commit on `main`, for the session's worktree. */
async function makeRepo(): Promise<string> {
  const repo = mkdtempSync(join(tmpdir(), "ac-smoke-repo-"));
  const git = (...args: string[]) => Bun.spawnSync(["git", "-C", repo, ...args], { env: GIT_ENV });
  git("init", "-b", "main");
  await Bun.write(join(repo, "README.md"), "smoke\n");
  git("add", ".");
  git("-c", "user.name=smoke", "-c", "user.email=smoke@example.com", "commit", "-m", "first");
  return repo;
}

type Events = { events: { kind: string; payload?: unknown }[] };

const REPLY = { kind: "reply", text: "hello from the mock agent" };

/**
 * Starts a session and waits for its turn to end; returns its id and events. The agent is the mock
 * agent, directly or (`claude-code`) as the program of the installed Claude Code adapter, and
 * does `steps` (a reply by default).
 */
export async function runsAMockSession(
  app: SmokeApp,
  options: { agent?: "mock" | "claude-code"; steps?: unknown[] } = {},
): Promise<{ id: string; events: Events["events"] }> {
  const steps = options.steps ?? [REPLY];
  await writeScript(app, [[...steps, { kind: "finish", stopReason: "end_turn" }]]);
  const agent = options.agent ?? "mock";
  const body = { agent, repoPath: await makeRepo(), baseBranch: "main", prompt: "hi" };
  const started = (await callApi(app, { method: "POST", path: "/api/sessions", body })) as {
    sessionId: string;
  };
  const events = await waitUntil({
    what: "the mock agent's turn to end",
    seconds: 60,
    read: async () => {
      const path = `/api/sessions/${started.sessionId}/events?after=0`;
      const { events } = (await callApi(app, { path })) as Events;
      return events.some((event) => event.kind === "turn-ended") ? events : undefined;
    },
  });
  return { id: started.sessionId, events };
}

export async function sessionRuns(app: SmokeApp): Promise<void> {
  const { events } = await runsAMockSession(app);
  expect(
    events.some((event) => event.kind === "agent-started"),
    "the agent never started",
  );
}
