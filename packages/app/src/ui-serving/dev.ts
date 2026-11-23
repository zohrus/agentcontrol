import { resolve } from "node:path";
import type { UiHandler } from "./types.ts";
import { launch, type Running, type Where } from "./vite-process.ts";

const RESTART_DELAY_MS = 1000;
const RESTART_TRIES = 5;
const STOP_TIMEOUT_MS = 5000;

/** Drops headers that no longer describe the body once `fetch` has decoded it. */
function plainHeaders(headers: Headers): Headers {
  const copy = new Headers(headers);
  copy.delete("content-encoding");
  copy.delete("content-length");
  return copy;
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

/** Asks the server to quit; one that does not within a few seconds is killed. */
async function stopServer(child: Running["child"]): Promise<void> {
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, STOP_TIMEOUT_MS);
  await child.exited;
  clearTimeout(timer);
}

interface Supervised {
  current: Running;
  closing: boolean;
}

/** Read through a function, because the flag changes while this code waits for a new server. */
const isClosing = (state: Supervised): boolean => state.closing;

/** Starts the UI server again, a few tries one second apart; undefined when it keeps failing. */
async function relaunch(options: Where & { state: Supervised }): Promise<Running | undefined> {
  for (let attempt = 1; attempt <= RESTART_TRIES && !isClosing(options.state); attempt++) {
    await Bun.sleep(RESTART_DELAY_MS);
    const running = await launch(options).catch((error: unknown) => {
      console.error(`The UI server did not start again: ${String(error)}`);
      return undefined;
    });
    if (running !== undefined) return running;
  }
  return undefined;
}

/** When the UI server dies by itself (not because the app closes it), a new one takes its place. */
function keepRunning(options: Where & { state: Supervised }): void {
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
export async function serveUiWithVite(options: {
  root: string;
  pidFile: string;
}): Promise<UiHandler> {
  const launching = { root: resolve(options.root), pidFile: options.pidFile };
  const state: Supervised = { current: await launch(launching), closing: false };
  keepRunning({ ...launching, state });
  return {
    fetch: forwardTo(() => state.current.port),
    close: async () => {
      state.closing = true;
      await stopServer(state.current.child);
    },
  };
}
