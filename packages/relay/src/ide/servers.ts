import { createHash } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ErrorCode, type SessionId } from "@agentcontrol/protocol";
import { agentEnvironment, type HostEnv } from "../agents/index.ts";
import { RelayError } from "../rpc/index.ts";
import { type CodeServer, startCodeServer } from "./code-server.ts";
import { detectCodeServer, INSTALL_HINT } from "./detect.ts";

const DEFAULT_IDLE_MS = 30 * 60 * 1000;

interface Running {
  server: CodeServer;
  /** Connections (requests and WebSockets) open right now. */
  open: number;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
}

export interface StartCall {
  sessionId: SessionId;
  folder: string;
  /** The session's own variables (its ports), which its terminal gets too. */
  env: Record<string, string>;
}

/** The private folder (mode 700) that holds the sockets: one short name per session. */
async function socketFor(options: { stateDir: string; sessionId: SessionId }): Promise<string> {
  const run = join(options.stateDir, "run");
  await mkdir(run, { recursive: true });
  await chmod(options.stateDir, 0o700);
  await chmod(run, 0o700);
  const name = createHash("sha256").update(options.sessionId).digest("hex").slice(0, 16);
  return join(run, `${name}.sock`);
}

async function installedOrRefuse(env: HostEnv): Promise<string[]> {
  const found = await detectCodeServer(env);
  if (found !== undefined) return found.command;
  const message = `code-server is not installed on this workspace. Install it with: ${INSTALL_HINT}`;
  throw new RelayError(ErrorCode.ideNotInstalled, message);
}

/**
 * The code-servers of one relay, one per session. A server ends when its session is archived, when
 * the relay stops, and after a period with no connection into it (30 minutes, or
 * AGENTCONTROL_IDE_IDLE_MS).
 */
export class Servers {
  private readonly running = new Map<SessionId, Running>();
  private readonly starting = new Map<SessionId, Promise<void>>();
  private readonly stateDir: string;
  private readonly idleMs: number;

  constructor(private readonly options: { dataDir: string; env: HostEnv }) {
    this.stateDir = join(options.dataDir, "ide");
    this.idleMs = Number(options.env["AGENTCONTROL_IDE_IDLE_MS"]) || DEFAULT_IDLE_MS;
  }

  isRunning(sessionId: SessionId): boolean {
    return this.running.has(sessionId);
  }

  /** The unix socket of the session's code-server, when one runs. */
  socketOf(sessionId: SessionId): string | undefined {
    return this.running.get(sessionId)?.server.socketPath;
  }

  /** Starts the session's code-server, or waits for the one that is starting. */
  async start(call: StartCall): Promise<void> {
    if (this.running.has(call.sessionId)) return;
    const pending = this.starting.get(call.sessionId) ?? this.launch(call);
    this.starting.set(call.sessionId, pending);
    try {
      await pending;
    } finally {
      this.starting.delete(call.sessionId);
    }
  }

  async stop(sessionId: SessionId): Promise<void> {
    // A server still starting is waited for, so archiving cannot leave one behind.
    await this.starting.get(sessionId)?.catch(() => undefined);
    const entry = this.running.get(sessionId);
    this.running.delete(sessionId);
    clearTimeout(entry?.idleTimer);
    await entry?.server.stop();
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.running.keys()].map((sessionId) => this.stop(sessionId)));
  }

  /** A connection into the server opens; the returned function says it ended. */
  connection(sessionId: SessionId): () => void {
    const entry = this.running.get(sessionId);
    if (entry === undefined) return () => undefined;
    entry.open += 1;
    clearTimeout(entry.idleTimer);
    return () => {
      entry.open -= 1;
      if (entry.open === 0 && this.running.get(sessionId) === entry) this.armIdle(sessionId, entry);
    };
  }

  private armIdle(sessionId: SessionId, entry: Running): void {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => {
      void this.stop(sessionId);
    }, this.idleMs);
  }

  private async launch(call: StartCall): Promise<void> {
    const { env } = this.options;
    const command = await installedOrRefuse(env);
    const { stateDir } = this;
    const socketPath = await socketFor({ stateDir, sessionId: call.sessionId });
    const spec = { command, folder: call.folder, socketPath, stateDir };
    const server = await startCodeServer({
      ...spec,
      env: { ...agentEnvironment(env), ...call.env },
    });
    const entry: Running = { server, open: 0, idleTimer: undefined };
    this.running.set(call.sessionId, entry);
    this.armIdle(call.sessionId, entry);
    // A code-server that dies on its own is forgotten, so the next start makes a new one.
    void server.exited.then(() => {
      if (this.running.get(call.sessionId) === entry) void this.stop(call.sessionId);
    });
  }
}
