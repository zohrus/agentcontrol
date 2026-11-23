// `bun dev`: the app with --watch and the default UI (Vite, hot reload), connected to the local
// relay. The first time the app says it is listening, the browser opens on it; a restart caused by
// a file change does not open it again. No browser opens when AGENTCONTROL_NO_OPEN is set or when
// there is no terminal. Extra arguments go to the app (`bun dev --port 4800`).
// AGENTCONTROL_OPEN_COMMAND (a JSON array) replaces `open`/`xdg-open`; tests use it.
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const LISTENING = /listening on (http:\/\/127\.0\.0\.1:\d+)/;

/** The command that opens `url`, or undefined when no browser should open. */
function openCommand(url: string): string[] | undefined {
  const env = process.env;
  if (env["AGENTCONTROL_NO_OPEN"]) return undefined;
  const custom = env["AGENTCONTROL_OPEN_COMMAND"];
  if (custom) return [...(JSON.parse(custom) as string[]), url];
  if (!process.stdout.isTTY) return undefined;
  return [process.platform === "darwin" ? "open" : "xdg-open", url];
}

function openBrowser(url: string): void {
  const command = openCommand(url);
  if (command === undefined) return;
  try {
    Bun.spawn(command, { stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
  } catch (error) {
    console.error(`Could not open the browser: ${String(error)}. Open ${url} yourself.`);
  }
}

const app = Bun.spawn(
  [
    process.execPath,
    "--watch",
    join(root, "packages/app/src/main.ts"),
    "--ui-root",
    join(root, "packages/ui-template"),
    ...process.argv.slice(2),
  ],
  { stdin: "inherit", stdout: "pipe", stderr: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.kill(signal);
  });
}

let opened = false;
let seen = "";
const decoder = new TextDecoder();
for await (const chunk of app.stdout) {
  const text = decoder.decode(chunk, { stream: true });
  seen += text;
  const url = opened ? undefined : LISTENING.exec(seen)?.[1];
  if (url !== undefined) {
    opened = true;
    openBrowser(url);
  }
  process.stdout.write(text);
}
process.exit(await app.exited);
