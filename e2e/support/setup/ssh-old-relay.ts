import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RelayName, type SessionId } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { eventually } from "./eventually.ts";
import { connectToRelay, type RelayClient } from "./relay-client.ts";
import type { SshHost } from "./ssh-host.ts";
import { writeRelayBinary } from "./ssh-relay-binary.ts";
import { socketWire } from "./wire.ts";

/** A relay of an older version already running on the host, as a previous app version left it. */
export interface OldRelay {
  readonly version: string;
  readonly pid: number;
  /** Starts a session in it whose agent works until it is cancelled, and waits until it works. */
  startsWorkingSession(): Promise<SessionId>;
  /** The session's agent stops, so the old relay has nothing left running. */
  endsTheWork(sessionId: SessionId): Promise<void>;
}

/** Connects to the relay daemon's socket once it is there, and follows its events. */
async function connectToDaemon(host: SshHost): Promise<RelayClient> {
  const socket = join(host.relayDataDir, "relay.sock");
  await eventually("expected the old relay to start", () =>
    Promise.resolve(existsSync(socket) ? undefined : "it has no socket yet"),
  );
  const client = connectToRelay(socketWire(socket));
  onTestEnd(() => client.disconnect());
  await client.call(RelayName.eventsSubscribe, { afterSeq: {} });
  return client;
}

/** Runs the host's relay daemon from a binary that reports `version`, and connects to its socket. */
async function runDaemonOfVersion(host: SshHost, version: string) {
  const binary = join(host.remoteRoot, "relay", version, "agentcontrol-relay");
  await mkdir(host.relayDataDir, { recursive: true });
  const mockAgentScript = host.mockAgent.scriptPath;
  await writeRelayBinary({ path: binary, home: host.home, mockAgentScript, version });
  const args = [binary, "daemon", "--data-dir", host.relayDataDir];
  const daemon = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
  onTestEnd(async () => {
    daemon.kill();
    await daemon.exited;
  });
  return { pid: daemon.pid, client: await connectToDaemon(host) };
}

async function startWorkingSession(host: SshHost, client: RelayClient): Promise<SessionId> {
  host.mockAgent.willWaitUntilCancelled();
  await host.mockAgent.writeScript();
  const { repoPath } = host;
  const params = { agent: "mock" as const, repoPath, baseBranch: "main", prompt: "Keep working" };
  const { sessionId } = await client.call(RelayName.sessionsCreate, params);
  await eventually("expected the old relay's agent to be working", async () => {
    const { sessions } = await client.call(RelayName.sessionsList, {});
    return sessions.find((each) => each.id === sessionId)?.turnRunning ? undefined : "it is not";
  });
  return sessionId;
}

/** Starts a relay that reports `version` in the host's relay folder, from its own binary folder. */
export async function startOldRelayOnHost(host: SshHost, version: string): Promise<OldRelay> {
  const { pid, client } = await runDaemonOfVersion(host, version);
  return {
    version,
    pid,
    startsWorkingSession: () => startWorkingSession(host, client),
    endsTheWork: async (sessionId) => {
      await client.call(RelayName.cancel, { sessionId });
    },
  };
}
