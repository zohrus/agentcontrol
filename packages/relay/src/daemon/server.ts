import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { HostEnv } from "../agents/index.ts";
import { configHome } from "../config/index.ts";
import { createEventLog } from "../event-log/index.ts";
import { createRepoStore, type RepoStore } from "../repos/index.ts";
import { createRpcConnection, type Handlers } from "../rpc/index.ts";
import { createSessions, type Sessions } from "../sessions/index.ts";
import { configHandlers } from "./handlers-config.ts";
import { fileHandlers } from "./handlers-files.ts";
import { sessionHandlers } from "./handlers-sessions.ts";
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
  });
  createInterface({ input: socket }).on("line", (line) => {
    connection.receive(line);
  });
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
}): Promise<Sessions> {
  const { dataDir, repos, hostEnv } = options;
  const log = createEventLog({ dir: join(dataDir, "sessions"), now: () => new Date() });
  return createSessions({ log, repos, worktreesDir: join(dataDir, "worktrees"), hostEnv });
}

export interface Daemon {
  /** The unix socket clients connect to. */
  readonly socketPath: string;
  /** Stops the agents, closes the socket and removes the files that say the relay is running. */
  stop(): Promise<void>;
}

export interface DaemonOptions {
  dataDir: string;
  /** Added to the process environment for agent commands and what agents inherit. */
  env?: Record<string, string>;
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

async function buildHandlers(options: DaemonOptions & { hostEnv: HostEnv }): Promise<{
  handlers: Handlers;
  sessions: Sessions;
}> {
  const { dataDir, hostEnv } = options;
  const repos = createRepoStore({ dataDir });
  const sessions = await buildSessions({ dataDir, repos, hostEnv });
  const handlers: Handlers = {
    ...sessionHandlers(sessions),
    ...fileHandlers(sessions),
    ...usageHandlers(sessions),
    ...workspaceHandlers(repos, hostEnv),
    ...configHandlers(configHome(hostEnv)),
  };
  return { handlers, sessions };
}

/** Listens on `<dataDir>/relay.sock` and serves every client until stopped. */
export async function startDaemon(options: DaemonOptions): Promise<Daemon> {
  const { dataDir } = options;
  await mkdir(dataDir, { recursive: true });
  const socketPath = socketPathIn(dataDir);
  await claimSocket(socketPath);
  const hostEnv = { ...process.env, ...options.env };
  const { handlers, sessions } = await buildHandlers({ dataDir, hostEnv });
  const { server, sockets } = createClientServer(handlers);
  await listenPrivately(server, socketPath);
  await writeFile(pidFileIn(dataDir), String(process.pid));
  return {
    socketPath,
    stop: async () => {
      server.close();
      sockets.forEach((socket) => socket.destroy());
      await sessions.shutdown();
      await rm(socketPath, { force: true });
      await rm(pidFileIn(dataDir), { force: true });
    },
  };
}
