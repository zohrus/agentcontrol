// Runs as its own process, started by the app (never in the browser): `server.ts <ui folder>`
// serves that UI project with Vite's dev server, so edits show up at once. Vite speaks Node's
// http, so it listens on a private port, prints `{"port":N}` on its first line when it is ready,
// and the app's own server forwards the UI's requests to it. It quits on SIGTERM, and when the
// app that started it is gone.
import { lstat, realpath } from "node:fs/promises";
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { createServer as createViteServer } from "vite";

/** Listens on a free local port; resolves with that port. */
async function listenOnFreePort(server: Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  return (server.address() as AddressInfo).port;
}

function stopListening(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

/** A TCP port that is free right now, for Vite's hot-reload socket. */
async function freePort(): Promise<number> {
  const probe = createHttpServer();
  const port = await listenOnFreePort(probe);
  await stopListening(probe);
  return port;
}

/**
 * The folders Vite may serve files from besides the project: where its node_modules really is,
 * because that folder is a link to the dependencies shipped with the app.
 */
async function allowedFolders(root: string): Promise<string[]> {
  const modules = await realpath(join(root, "node_modules")).catch(() => undefined);
  return modules === undefined ? [root] : [root, modules];
}

/**
 * Where Vite keeps its cache. Vite's own place is `node_modules/.vite`; when that folder is a link
 * to the dependencies shipped with the app, the cache goes into the project's own `.vite` folder
 * instead, because nothing may be written into the shipped folder (an installed app is signed).
 */
async function cacheFolder(root: string): Promise<{ cacheDir?: string }> {
  const modules = await lstat(join(root, "node_modules")).catch(() => undefined);
  return modules?.isSymbolicLink() === true ? { cacheDir: join(root, ".vite") } : {};
}

/** Starts Vite for the UI project in `root`, with hot reload and index.html for every unknown path. */
async function startUiDevServer(
  root: string,
): Promise<{ port: number; close: () => Promise<void> }> {
  const vite = await createViteServer({
    root,
    ...(await cacheFolder(root)),
    configLoader: "runner",
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: { host: "127.0.0.1", port: await freePort() },
      fs: { allow: await allowedFolders(root) },
    },
  });
  const inner = createHttpServer(vite.middlewares);
  const port = await listenOnFreePort(inner);
  return {
    port,
    close: async () => {
      await vite.close();
      await stopListening(inner);
    },
  };
}

const root = process.argv[2];
if (root === undefined) {
  console.error("Usage: server.ts <ui folder>");
  process.exit(2);
}
const server = await startUiDevServer(resolve(root));
console.log(JSON.stringify({ port: server.port }));
let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  void server.close().finally(() => process.exit(0));
};
process.on("SIGTERM", stop);
// When the app dies without stopping this process, init adopts it; that is the sign to quit.
const app = process.ppid;
setInterval(() => {
  if (process.ppid !== app) stop();
}, 1000);
