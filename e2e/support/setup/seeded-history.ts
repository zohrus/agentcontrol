import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { SessionId } from "@agentcontrol/protocol";
import type { RelayAccess } from "./relay.ts";

const AGENT_CHUNK = {
  jsonrpc: "2.0",
  method: "session/update",
  params: {
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Working..." } },
  },
};

const REQUEST_TO_RUN_NPM_TEST = {
  kind: "permission-requested",
  payload: {
    requestId: "request-1",
    toolCall: { title: "Run npm test", kind: "execute", rawInput: { command: "npm test" } },
    options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
  },
};

function openingEvents(id: string) {
  return [
    {
      kind: "session-created",
      payload: {
        agent: "mock",
        repoPath: "/repo",
        baseBranch: "main",
        branch: `agentcontrol/${id}`,
        worktreePath: `/worktrees/${id}`,
        title: `Session ${id}`,
      },
    },
    { kind: "setup-finished", payload: { exitCode: 0 } },
    { kind: "agent-started", payload: {} },
    { kind: "prompt-sent", payload: { text: "Run the tests" } },
  ];
}

/** One session's log as a relay would have written it: it asked to run `npm test` and is still waiting. */
function logOfWaitingSession(call: { id: string; eventCount: number }): string {
  const { id, eventCount } = call;
  const ts = new Date().toISOString();
  const opening = openingEvents(id);
  const request = REQUEST_TO_RUN_NPM_TEST;
  const chunks = Array.from({ length: eventCount - opening.length - 1 }, () => ({
    kind: "acp",
    payload: { direction: "from-agent", message: AGENT_CHUNK },
  }));
  const events = [...opening, ...chunks, request];
  return `${events.map((event, index) => JSON.stringify({ sessionId: id, seq: index + 1, ts, ...event })).join("\n")}\n`;
}

/**
 * Writes the logs of sessions that each hold `eventCount` events and end waiting for approval,
 * straight into the relay's data folder. The relay reads them the next time it starts.
 */
export async function writeLongSessionLogs(
  relay: RelayAccess,
  call: { sessions: number; eventCount: number },
): Promise<SessionId[]> {
  const ids = Array.from({ length: call.sessions }, (_, index) => `long-${String(index)}`);
  await Promise.all(
    ids.map(async (id) => {
      const dir = join(relay.dataDir, "sessions", id);
      await mkdir(dir, { recursive: true });
      await Bun.write(join(dir, "events.jsonl"), logOfWaitingSession({ id, ...call }));
    }),
  );
  return ids as SessionId[];
}

/** Deletes every session log from the relay's data folder while the relay keeps running. */
export async function removeSessionLogs(relay: RelayAccess): Promise<void> {
  await rm(join(relay.dataDir, "sessions"), { recursive: true, force: true });
}
