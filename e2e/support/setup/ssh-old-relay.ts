import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RelayName, type SessionId, VERSION } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { eventually } from "./eventually.ts";
import { connectToRelay, type RelayClient } from "./relay-client.ts";
import { startsWorkingSession } from "./relay-working-session.ts";
import type { SshHost } from "./ssh-host.ts";
import { writeRelayBinary } from "./ssh-relay-binary.ts";
import { tryConnect } from "./try-connect.ts";
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

/** What the old relay says it is, besides what its binary was installed as. */
export interface OldRelayIdentity {
  version: string;
  /** The code it runs, when that differs under the same version; none reported by default. */
  buildId?: string;
}

/**
 * Connects to the relay daemon's socket once it takes clients, and follows its events. The socket
 * file is there a moment before the daemon listens on it, so the file is not proof: only a
 * connection that is accepted is.
 */
async function connectToDaemon(host: SshHost): Promise<RelayClient> {
  const socket = join(host.relayDataDir, "relay.sock");
  await eventually("expected the old relay to start", async () => {
    const probe = existsSync(socket) ? await tryConnect(socket) : undefined;
    probe?.destroy();
    return probe === undefined ? "it takes no clients yet" : undefined;
  });
  const client = connectToRelay(socketWire(socket));
  onTestEnd(() => client.disconnect());
  await client.call(RelayName.eventsSubscribe, { afterSeq: {} });
  return client;
}

/** Runs the host's relay daemon from a binary that reports `identity`, and connects to its socket. */
async function runDaemonOf(host: SshHost, identity: OldRelayIdentity) {
  const { version, buildId } = identity;
  const binary = join(host.remoteRoot, "relay", version, "agentcontrol-relay");
  await mkdir(host.relayDataDir, { recursive: true });
  const mockAgentScript = host.mockAgent.scriptPath;
  const spec = { path: binary, home: host.home, mockAgentScript, version };
  await writeRelayBinary({ ...spec, ...(buildId !== undefined && { buildId }) });
  const args = [binary, "daemon", "--data-dir", host.relayDataDir];
  const daemon = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
  onTestEnd(async () => {
    daemon.kill();
    await daemon.exited;
  });
  return { pid: daemon.pid, client: await connectToDaemon(host) };
}

/** The relay file installed on the host is one that an earlier build left, with no relay running. */
export async function leaveAnOlderBuildInstalledOn(host: SshHost): Promise<void> {
  const { home, mockAgent, installedRelay: path } = host;
  const spec = { path, home, mockAgentScript: mockAgent.scriptPath, version: VERSION };
  await mkdir(join(host.remoteRoot, "relay", VERSION), { recursive: true });
  await writeRelayBinary({ ...spec, buildId: "built-before-the-update" });
}

/** Starts a relay that reports `identity` in the host's relay folder, from its own binary file. */
export async function startOldRelayOnHost(
  host: SshHost,
  identity: OldRelayIdentity | string,
): Promise<OldRelay> {
  const wanted = typeof identity === "string" ? { version: identity } : identity;
  const { pid, client } = await runDaemonOf(host, wanted);
  return {
    version: wanted.version,
    pid,
    startsWorkingSession: () =>
      startsWorkingSession({ client, mockAgent: host.mockAgent, repoPath: host.repoPath }),
    endsTheWork: async (sessionId) => {
      await client.call(RelayName.cancel, { sessionId });
    },
  };
}
