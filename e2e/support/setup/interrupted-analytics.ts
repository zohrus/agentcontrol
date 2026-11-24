import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type RunningApp, startAppWithLocalWorkspace } from "./start-app.ts";

const HOUR_MS = 3_600_000;

/** The log of a session whose agent asked for permission two seconds into its turn, then nothing. */
function logWithAnUnansweredRequest(call: { id: string; title: string; startedAt: number }) {
  const { id, title, startedAt } = call;
  const created = {
    agent: "mock",
    repoPath: "/repo",
    baseBranch: "main",
    branch: `agentcontrol/${id}`,
    worktreePath: `/worktrees/${id}`,
    title,
  };
  const options = [{ optionId: "allow", name: "Allow", kind: "allow_once" }];
  const toolCall = { title: "Run npm test", kind: "execute" };
  const requested = { requestId: "request-open", toolCall, options };
  const events = [
    { atSec: 0, kind: "session-created", payload: created },
    { atSec: 1, kind: "setup-finished", payload: { exitCode: 0 } },
    { atSec: 2, kind: "agent-started", payload: {} },
    { atSec: 3, kind: "prompt-sent", payload: { text: "Run the tests" } },
    { atSec: 5, kind: "permission-requested", payload: requested },
  ];
  return `${events
    .map(({ atSec, ...event }, index) => {
      const ts = new Date(startedAt + atSec * 1000).toISOString();
      return JSON.stringify({ sessionId: id, seq: index + 1, ts, ...event });
    })
    .join("\n")}\n`;
}

/**
 * An app whose relay found, on starting, a session whose agent was waiting for approval an hour
 * ago, when the relay died. Nothing was written since.
 */
export async function startAppWhoseRelayDiedAnHourAgoWithARequestWaiting(
  title: string,
): Promise<RunningApp> {
  const app = await startAppWithLocalWorkspace();
  const id = crypto.randomUUID();
  const folder = join(app.dataDir, "relay", "sessions", id);
  await mkdir(folder, { recursive: true });
  const log = logWithAnUnansweredRequest({ id, title, startedAt: Date.now() - HOUR_MS });
  await Bun.write(join(folder, "events.jsonl"), log);
  await app.theRelayStops();
  await app.theRelayStartsAgain();
  return app;
}
