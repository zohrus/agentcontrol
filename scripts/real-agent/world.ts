import { join } from "node:path";
import type { SessionEvent, SessionId, SessionRow } from "../../packages/sdk/src/index.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "../../e2e/support/setup/start-app.ts";
import { createUiTemplate } from "../../e2e/support/setup/modify-app.ts";
import { cleanUpAfterTest } from "../../e2e/support/setup/cleanup.ts";
import { addTinyProject } from "./project.ts";
import { waitFor } from "./wait.ts";

/** The cheapest capable Claude model the adapter offers (its "haiku" alias); Claude Code reads this variable. */
const CHEAP_MODEL = "haiku";

export interface World {
  readonly app: RunningApp;
  /** Starts a session on the tiny project and returns its id. */
  startsSession(prompt: string): Promise<SessionId>;
  /** Waits for a condition on the session's summary. */
  waitsForSession(options: {
    id: SessionId;
    describe: string;
    when: (row: SessionRow) => boolean;
  }): Promise<SessionRow>;
  /** Every event of the session, oldest first. */
  eventsOf(id: SessionId): Promise<SessionEvent[]>;
  /** Where the relay keeps this session's event log. */
  logOf(id: SessionId): string;
  /** Tears everything down (app, relay, temp folders). */
  closes(): Promise<void>;
}

export interface WorldOptions {
  agent: "claude-code" | "codex";
  /** Make the app ready for Modify requests, with a copy of the tiny fixture UI as its default UI. */
  modify?: boolean;
  /** Also serve the default UI, so a browser can open the app. */
  withUi?: boolean;
}

async function startApp(options: WorldOptions) {
  const relayEnv: Record<string, string> =
    options.agent === "claude-code" ? { ANTHROPIC_MODEL: CHEAP_MODEL } : {};
  const modify = options.modify
    ? { agent: options.agent, templateDir: await createUiTemplate(), templateVersion: "1.0" }
    : undefined;
  const app = await startAppWithLocalWorkspace({
    relayEnv,
    ...(modify ? { modify } : {}),
    ...(options.withUi ? { withUi: true } : {}),
  });
  await addTinyProject(app.repoPath);
  return app;
}

/** The app and relay running in this process with a tiny project, as the e2e harness starts them. */
export async function openWorld(options: WorldOptions): Promise<World> {
  const app = await startApp(options);
  const readRow = (id: SessionId) => app.sdk.sessions.get(id);
  return {
    app,
    startsSession: (prompt) =>
      app.sdk.sessions.start({
        agent: options.agent,
        repoPath: app.repoPath,
        baseBranch: "main",
        prompt,
        title: prompt.slice(0, 60),
      }),
    waitsForSession: ({ id, describe, when }) =>
      waitFor({
        describe,
        read: async () => {
          const row = await readRow(id);
          return when(row) ? row : undefined;
        },
      }),
    eventsOf: (id) => app.sdk.sessions.events(id, { after: 0 }),
    logOf: (id) => join(app.dataDir, "relay", "sessions", id, "events.jsonl"),
    closes: cleanUpAfterTest,
  };
}
