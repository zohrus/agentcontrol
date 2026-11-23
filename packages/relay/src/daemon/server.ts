import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { NORMALISER_VERSION } from "../acp-normalise/index.ts";
import { ADAPTER_CACHE, type HostEnv } from "../agents/index.ts";
import { configHome } from "../config/index.ts";
import { type SessionId, VERSION } from "@agentcontrol/protocol";
import { createEventLog } from "../event-log/index.ts";
import { createRepoStore, type RepoStore } from "../repos/index.ts";
import { createRpcConnection, type Handlers } from "../rpc/index.ts";
import { createSessions, type Sessions } from "../sessions/index.ts";
import { createTerminals, type Terminals } from "../terminal/index.ts";
import { configHandlers } from "./handlers-config.ts";
import { fileHandlers } from "./handlers-files.ts";
import { sessionHandlers } from "./handlers-sessions.ts";
import { terminalHandlers } from "./handlers-terminal.ts";
import { usageHandlers } from "./handlers-usage.ts";
import { workspaceHandlers } from "./handlers-workspace.ts";
import { socketPathIn, tryConnect } from "./socket.ts";

export const pidFileIn = (dataDir: string): string => join(dataDir, "relay.pid");

function serve(socket: Socket, handlers: Handlers): void {
  const connection = createRpcConnection({
    handlers,
    send: (line) => {
      if (socket.writable) socket.write(`${line}\n`);
    },
    backlog: () => socket.writableLength,
  });
  // A client that hangs up while an answer is being written makes the socket fail; the reader
  // passes that on as its own error, which nobody may leave unhandled.
  createInterface({ input: socket })
    .on("line", (line) => {
      connection.receive(line);
    })
    .on("error", () => undefined);
  socket.on("close", () => {
    connection.close();
  });
  socket.on("error", () => undefined);
}

async function claimSocket(socketPath: string): Promise<void> {
  const running = await tryConnect(socketPath);
  if (running) {
    running.destroy();
    throw new Error(`A relay is already running at ${socketPath}.`);
  }
  await rm(socketPath, { force: true });
}

async function listenPrivately(server: Server, socketPath: string): Promise<void> {
  const previousMask = process.umask(0o177);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  process.umask(previousMask);
  await chmod(socketPath, 0o600);
}

async function buildSessions(options: {
  dataDir: string;
  repos: RepoStore;
  hostEnv: HostEnv;
  terminals: Terminals;
}): Promise<Sessions> {
  const { dataDir, repos, hostEnv, terminals } = options;
  const log = createEventLog({ dir: join(dataDir, "sessions"), now: () => new Date() });
  const worktreesDir = join(dataDir, "worktrees");
  const endTerminals = (sessionId: SessionId): Promise<void> => terminals.closeSession(sessionId);
  return createSessions({ log, repos, worktreesDir, hostEnv, endTerminals });
}

export interface Daemon {
  /** The unix socket clients connect to. */
  readonly socketPath: string;
  /**
   * Stops accepting clients, stops the agents and records their last events, then ends the
   * clients' connections (they have been sent those events) and removes the files that say the
   * relay is running.
   */
  stop(): Promise<void>;
}

export interface DaemonOptions {
  dataDir: string;
  /** Added to the process environment for agent commands and what agents inherit. */
  env?: Record<string, string>;
  /** What `relay/hello` reports as the version of the event translation; the current one if left out. */
  normaliserVersion?: number;
  /** What `relay/hello` reports as the relay's version; this release's version if left out. */
  relayVersion?: string;
  /**
   * A test seam: `relay/terminal.open` waits for this after finding the session's folder and before
   * starting the shell, so a test can make the client leave in between.
   */
  beforeShellStarts?: () => Promise<void>;
}

/** The socket server: every connection is served with the handlers and tracked, to end it on stop. */
function createClientServer(handlers: Handlers): { server: Server; sockets: Set<Socket> } {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });
    serve(socket, handlers);
  });
  return { server, sockets };
}

const CLIENT_CLOSE_MS = 1000;

/** Ends every client connection after what was queued for it is sent; a stuck one is destroyed. */
async function closeClients(sockets: Set<Socket>): Promise<void> {
  const closed = [...sockets].map(
    (socket) =>
      new Promise<void>((resolve) => {
        socket.once("close", () => {
          resolve();
        });
        socket.end();
      }),
  );
  const giveUp = setTimeout(() => {
    sockets.forEach((socket) => socket.destroy());
  }, CLIENT_CLOSE_MS);
  await Promise.all(closed);
  clearTimeout(giveUp);
}

async function buildHandlers(options: DaemonOptions & { hostEnv: HostEnv }): Promise<{
  handlers: Handlers;
  sessions: Sessions;
  terminals: Terminals;
}> {
  const { dataDir, hostEnv } = options;
  const repos = createRepoStore({ dataDir });
  const terminals = createTerminals({ hostEnv });
  const sessions = await buildSessions({ dataDir, repos, hostEnv, terminals });
  const handlers: Handlers = {
    ...sessionHandlers(sessions),
    ...terminalHandlers({
      sessions,
      terminals,
      ...(options.beforeShellStarts && { beforeShellStarts: options.beforeShellStarts }),
    }),
    ...fileHandlers(sessions),
    ...usageHandlers(sessions),
    ...workspaceHandlers({
      repos,
      env: hostEnv,
      normaliserVersion: options.normaliserVersion ?? NORMALISER_VERSION,
      // AGENTCONTROL_RELAY_VERSION is only set by tests, to look like another release.
      relayVersion: options.relayVersion ?? hostEnv["AGENTCONTROL_RELAY_VERSION"] ?? VERSION,
    }),
    ...configHandlers(configHome(hostEnv)),
  };
  return { handlers, sessions, terminals };
}

/** The process environment plus `options.env`; adapters are downloaded into the relay's folder. */
function hostEnvFor(options: DaemonOptions): HostEnv {
  const adapterCache = { [ADAPTER_CACHE]: join(options.dataDir, "adapters") };
  return { ...adapterCache, ...process.env, ...options.env };
}

/** Listens on `<dataDir>/relay.sock` and serves every client until stopped. */
export async function startDaemon(options: DaemonOptions): Promise<Daemon> {
  const { dataDir } = options;
  await mkdir(dataDir, { recursive: true });
  const socketPath = socketPathIn(dataDir);
  await claimSocket(socketPath);
  const hostEnv = hostEnvFor(options);
  const { handlers, sessions, terminals } = await buildHandlers({ ...options, hostEnv });
  const { server, sockets } = createClientServer(handlers);
  await listenPrivately(server, socketPath);
  await writeFile(pidFileIn(dataDir), String(process.pid));
  return {
    socketPath,
    stop: async () => {
      server.close();
      await sessions.shutdown();
      await terminals.closeAll();
      await closeClients(sockets);
      await rm(socketPath, { force: true });
      await rm(pidFileIn(dataDir), { force: true });
    },
  };
}
