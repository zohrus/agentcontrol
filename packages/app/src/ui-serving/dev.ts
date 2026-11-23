import { join, resolve } from "node:path";
import { findResources } from "../resources/index.ts";
import type { UiHandler } from "./types.ts";

const START_TIMEOUT_MS = 60_000;
const RESTART_DELAY_MS = 1000;
const RESTART_TRIES = 5;

type DevServer = Bun.Subprocess<"ignore", "pipe", "inherit">;

/** A UI server process and the port it listens on. */
interface Running {
  child: DevServer;
  port: number;
}

/** Drops headers that no longer describe the body once `fetch` has decoded it. */
function plainHeaders(headers: Headers): Headers {
  const copy = new Headers(headers);
  copy.delete("content-encoding");
  copy.delete("content-length");
  return copy;
}

/** The first line the dev server prints says where it listens; the rest is its log. */
async function readPort(child: DevServer): Promise<number> {
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let seen = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done)
      throw new Error(`The UI server stopped before it was ready. It printed: ${seen}`);
    seen += decoder.decode(chunk.value, { stream: true });
    if (seen.includes("\n")) break;
  }
  reader.releaseLock();
  void child.stdout.pipeTo(new WritableStream({ write: (log) => void process.stderr.write(log) }));
  return (JSON.parse(seen.split("\n")[0] ?? "") as { port: number }).port;
}

function afterTimeout(child: DevServer): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      child.kill();
      reject(new Error("The UI server did not start in time."));
    }, START_TIMEOUT_MS).unref();
  });
}

/**
 * Runs the UI template's `server.ts` (Vite) as a child process: the app binary is started as
 * `bun` (BUN_BE_BUN), so no other runtime has to be installed. It quits when the app does.
 */
function startDevServer(root: string): DevServer {
  const script = join(
    findResources({ env: process.env, execPath: process.execPath }).templateDir,
    "server.ts",
  );
  return Bun.spawn([process.execPath, script, root], {
    cwd: root,
    env: { ...process.env, BUN_BE_BUN: "1" },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
}

async function launch(root: string): Promise<Running> {
  const child = startDevServer(root);
  const port = await Promise.race([readPort(child), afterTimeout(child)]).catch(
    (error: unknown) => {
      child.kill();
      throw error;
    },
  );
  return { child, port };
}

function forwardTo(port: () => number): UiHandler["fetch"] {
  return async (request) => {
    const { pathname, search } = new URL(request.url);
    const target = `http://127.0.0.1:${String(port())}${pathname}${search}`;
    const answer = await fetch(target, {
      headers: request.headers,
      redirect: "manual",
      signal: request.signal,
    }).catch(() => undefined);
    if (answer === undefined) return new Response("The UI is not available.", { status: 503 });
    return new Response(answer.body, {
      status: answer.status,
      headers: plainHeaders(answer.headers),
    });
  };
}

interface Supervised {
  current: Running;
  closing: boolean;
}

/** Read through a function, because the flag changes while this code waits for a new server. */
const isClosing = (state: Supervised): boolean => state.closing;

/** Starts the UI server again, a few tries one second apart; undefined when it keeps failing. */
async function relaunch(options: {
  root: string;
  state: Supervised;
}): Promise<Running | undefined> {
  for (let attempt = 1; attempt <= RESTART_TRIES && !isClosing(options.state); attempt++) {
    await Bun.sleep(RESTART_DELAY_MS);
    const running = await launch(options.root).catch((error: unknown) => {
      console.error(`The UI server did not start again: ${String(error)}`);
      return undefined;
    });
    if (running !== undefined) return running;
  }
  return undefined;
}

/** When the UI server dies by itself (not because the app closes it), a new one takes its place. */
function keepRunning(options: { root: string; state: Supervised }): void {
  const { state } = options;
  void state.current.child.exited.then(async () => {
    if (isClosing(state)) return;
    console.error("The UI server stopped. Starting it again.");
    const next = await relaunch(options);
    if (next === undefined) return;
    if (isClosing(state)) next.child.kill();
    state.current = next;
    keepRunning(options);
  });
}

/** Serves the UI project in `root` with Vite's dev server, so edits appear without a reload. */
export async function serveUiWithVite(root: string): Promise<UiHandler> {
  const folder = resolve(root);
  const state: Supervised = { current: await launch(folder), closing: false };
  keepRunning({ root: folder, state });
  return {
    fetch: forwardTo(() => state.current.port),
    close: async () => {
      state.closing = true;
      state.current.child.kill("SIGTERM");
      await state.current.child.exited;
    },
  };
}
