import { client, methods, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { join } from "node:path";
import { type Conversation, conversationOf, type Decide, outcomeFor } from "./conversation.ts";
import { onTestEnd } from "./cleanup.ts";
import type { MockAgent } from "./mock-agent-script.ts";
import { Timeline } from "./timeline.ts";

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

function spawnMockAgent(mockAgent: MockAgent) {
  const process = Bun.spawn(["bun", mockAgentMain], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
    env: { ...Bun.env, MOCK_AGENT_SCRIPT: mockAgent.scriptPath },
  });
  onTestEnd(async () => {
    process.kill();
    await process.exited;
  });
  const toAgent = new WritableStream<Uint8Array>({
    async write(chunk) {
      void process.stdin.write(chunk);
      await process.stdin.flush();
    },
  });
  return ndJsonStream(toAgent, process.stdout);
}

function recordingClient(timeline: Timeline, pendingDecisions: Decide[]) {
  return client({ name: "e2e-test-client" })
    .onNotification(methods.client.session.update, ({ params }) => {
      timeline.record({ kind: "update", update: params.update });
    })
    .onRequest(methods.client.session.requestPermission, ({ params }) => {
      timeline.record({ kind: "permission", request: params });
      return new Promise((resolve) => {
        pendingDecisions.push((kind) => {
          resolve(outcomeFor(params.options, kind));
        });
      });
    });
}

/** Spawns the mock agent, does `initialize` and `session/new`, and records what the agent sends. */
export async function startMockAgentSession(mockAgent: MockAgent): Promise<Conversation> {
  await mockAgent.writeScript();
  const timeline = new Timeline();
  const pendingDecisions: Decide[] = [];
  const connection = recordingClient(timeline, pendingDecisions).connect(spawnMockAgent(mockAgent));
  await connection.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION });
  const { sessionId } = await connection.agent.request(methods.agent.session.new, {
    cwd: mockAgent.dataFolder,
    mcpServers: [],
  });
  return conversationOf({ connection, sessionId, timeline, pendingDecisions });
}
