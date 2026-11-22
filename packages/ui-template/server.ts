// Runs inside the app process (never in the browser): serves a UI folder with Vite's dev server,
// so edits show up at once. Vite speaks Node's http, so it listens on a private port and the app's
// own server forwards the UI's requests to it.
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createServer as createViteServer } from "vite";

/** The UI dev server as the app mounts it: answer a request, or shut down. */
export interface UiDevServer {
  fetch: (request: Request) => Promise<Response>;
  close: () => Promise<void>;
}

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

/** Drops headers that no longer describe the body once `fetch` has decoded it. */
function plainHeaders(headers: Headers): Headers {
  const copy = new Headers(headers);
  copy.delete("content-encoding");
  copy.delete("content-length");
  return copy;
}

/** Starts Vite for the UI project in `root`; with hot reload, and index.html for every unknown path. */
export async function createUiDevServer(options: { root: string }): Promise<UiDevServer> {
  const vite = await createViteServer({
    root: options.root,
    appType: "spa",
    server: { middlewareMode: true, hmr: { port: await freePort() } },
  });
  const inner = createHttpServer(vite.middlewares);
  const port = await listenOnFreePort(inner);
  return {
    fetch: async (request) => {
      const { pathname, search } = new URL(request.url);
      const target = `http://127.0.0.1:${String(port)}${pathname}${search}`;
      const answer = await fetch(target, { headers: request.headers }).catch(() => undefined);
      if (answer === undefined) return new Response("The UI is not available.", { status: 503 });
      return new Response(answer.body, {
        status: answer.status,
        headers: plainHeaders(answer.headers),
      });
    },
    close: async () => {
      await vite.close();
      await stopListening(inner);
    },
  };
}
