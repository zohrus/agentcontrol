import { RelayName, type SessionId } from "@agentcontrol/protocol";
import { eventually } from "./eventually.ts";
import type { MockAgent } from "./mock-agent-script.ts";
import { connectToRelay, type RelayClient } from "./relay-client.ts";
import type { RelayHost } from "./relay-host.ts";

/** A session works in the relay of this test before any app is connected to it. */
export async function aSessionWorkingInTheRelay(options: {
  host: RelayHost;
  mockAgent: MockAgent;
  repoPath: string;
}): Promise<void> {
  const client = connectToRelay(options.host.wire());
  try {
    await startsWorkingSession({ ...options, client });
  } finally {
    await client.disconnect();
  }
}

/** Starts a session in the relay whose agent works until it is cancelled, and waits until it does. */
export async function startsWorkingSession(options: {
  client: RelayClient;
  mockAgent: MockAgent;
  repoPath: string;
}): Promise<SessionId> {
  const { client, mockAgent, repoPath } = options;
  mockAgent.willWaitUntilCancelled();
  await mockAgent.writeScript();
  const params = { agent: "mock" as const, repoPath, baseBranch: "main", prompt: "Keep working" };
  const { sessionId } = await client.call(RelayName.sessionsCreate, params);
  await eventually("expected the relay's agent to be working", async () => {
    const { sessions } = await client.call(RelayName.sessionsList, {});
    return sessions.find((each) => each.id === sessionId)?.turnRunning ? undefined : "it is not";
  });
  return sessionId;
}
