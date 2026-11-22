import { join } from "node:path";

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

/**
 * Starts `main.ts` with its own data folder and waits for its "listening" line. It takes a free
 * port unless `port` is given (to come back where a browser is still pointing); `extraArgs` can
 * ask it to serve the UI.
 */
export async function launchApp(options: {
  dataDir: string;
  env: Record<string, string>;
  port?: number;
  extraArgs?: string[];
}): Promise<AppProcess> {
  const port = String(options.port ?? 0);
  const args = ["--port", port, "--data-dir", options.dataDir, ...(options.extraArgs ?? [])];
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
