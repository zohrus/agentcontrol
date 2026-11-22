import { join } from "node:path";
import { type ModifyConfig, relayClientOver, startApp } from "@agentcontrol/app";
import { eventually } from "./eventually.ts";
import { inSubprocesses, type RelayHost } from "./relay-host.ts";

const appMain = join(import.meta.dir, "../../../packages/app/src/main.ts");
const START_TIMEOUT_MS = 30_000;

/** The app running as its own process, as a user's launcher would start it. */
export interface AppProcess {
  readonly baseUrl: string;
  /** Asks the app to quit (SIGTERM) and waits until it has; the relay daemon keeps running. */
  stop(): Promise<void>;
}

async function readListeningUrl(stdout: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let seen = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`the app exited before it was listening. It printed: ${seen}`);
    seen += decoder.decode(chunk.value, { stream: true });
    const url = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(seen)?.[1];
    if (url !== undefined) return url;
  }
}

function afterTimeout(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("the app did not report that it was listening in time"));
    }, START_TIMEOUT_MS);
  });
}

function uiFlags(ui: ProcessLaunch["ui"]): string[] {
  const { root, dist } = ui ?? {};
  return [...(root ? ["--ui-root", root] : []), ...(dist ? ["--ui-dist", dist] : [])];
}

/** Starts `main.ts` on a free port with its own data folder and waits for its "listening" line. */
export async function launchAppProcess(options: ProcessLaunch): Promise<AppProcess> {
  const port = String(options.port ?? 0);
  const args = ["--port", port, "--data-dir", options.dataDir, ...uiFlags(options.ui)];
  const child = Bun.spawn(["bun", appMain, ...args], {
    stdout: "pipe",
    stderr: "inherit",
    env: { ...Bun.env, ...options.env },
  });
  const baseUrl = await Promise.race([readListeningUrl(child.stdout), afterTimeout()]);
  return {
    baseUrl,
    stop: async () => {
      child.kill("SIGTERM");
      await child.exited;
    },
  };
}

/** What starting the app as its own process takes. */
interface ProcessLaunch {
  dataDir: string;
  env: Record<string, string>;
  /** The port to come back on after a restart (so a browser can find the app); free port if left out. */
  port?: number;
  /** Serve the UI: a project folder with Vite, or a folder of built files. */
  ui?: { root?: string; dist?: string };
}

interface LaunchOptions extends ProcessLaunch {
  host: RelayHost;
  /** The relay is stopped on purpose: do not wait for the app to connect to it. */
  relayDown?: boolean | undefined;
  /** The default UI and Modify agent; in-process runs only. */
  modify?: ModifyConfig | undefined;
  /** Called each time a connection the app opened to the relay ends (in-process only). */
  onRelayConnectionEnded: () => void;
}

/** Starts the app inside this test process, talking to the relay over its socket. */
async function launchAppInProcess(options: LaunchOptions): Promise<AppProcess> {
  const app = await startApp({
    dataDir: options.dataDir,
    port: options.port ?? 0,
    ...(options.ui && { ui: options.ui }),
    ...(options.modify && { modify: options.modify }),
    connectRelay: () => {
      const wire = options.host.wire();
      void wire.closed.then(options.onRelayConnectionEnded);
      return relayClientOver(wire);
    },
  });
  return { baseUrl: app.url, stop: () => app.stop() };
}

/** Polls the app's health check until it reports the relay connected: the app starts without it. */
async function waitUntilRelayConnected(app: AppProcess): Promise<void> {
  await eventually("expected the started app to connect to the relay", async () => {
    const response = await fetch(`${app.baseUrl}/api/health`);
    const { relay } = (await response.json()) as { relay: string };
    return relay === "connected" ? undefined : `the relay is ${relay}`;
  });
}

/**
 * Starts the app on a free port, as a subprocess when asked for, otherwise in this process. Returns
 * once the app is connected to its relay, unless the relay is meant to be down.
 */
export async function launchApp(options: LaunchOptions): Promise<AppProcess> {
  const app = await (inSubprocesses ? launchAppProcess(options) : launchAppInProcess(options));
  if (!options.relayDown) await waitUntilRelayConnected(app);
  return app;
}
