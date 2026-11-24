// A scripted stand-in for code-server, started by the relay through AGENTCONTROL_CODE_SERVER_CMD.
// It accepts the flags the relay passes, listens on the unix socket it is given (never on TCP),
// and serves what the tests need: a page, a static file, a streamed download, an upload echo, the
// request's headers, an "attack" page whose script tries to reach the app, and a WebSocket echo.
import { chmodSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Server } from "bun";
import { flagsOf } from "./flags.ts";
import { servePage } from "./pages.ts";

const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("4.99.9 fake-hash with Code 1.99.9");
  process.exit(0);
}

if (process.env["FAKE_CODE_SERVER_FAILS"]) {
  console.error("fake code-server: cannot start (FAKE_CODE_SERVER_FAILS is set)");
  process.exit(3);
}

const flags = flagsOf(args);
const socket = flags.value("--socket");
if (socket === undefined) {
  console.error("fake code-server: --socket is required (it never opens a TCP port)");
  process.exit(2);
}

// A child in the same process group, like the extension host of the real thing.
const helper = Bun.spawn(["sleep", "600"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });

// What the tests read: how it was started.
const stateDir = dirname(flags.value("--user-data-dir") ?? socket);
const invocation = { pid: process.pid, helperPid: helper.pid, argv: args, folder: flags.folder() };
const more = { cwd: process.cwd(), home: process.env["HOME"], port: process.env["PORT"] };
writeFileSync(
  join(stateDir, `fake-${String(process.pid)}.json`),
  JSON.stringify({ ...invocation, ...more }),
);

/** Accepts the WebSocket, answering with the first subprotocol the browser offered. */
function upgrade(request: Request, server: Server<undefined>): boolean {
  if (new URL(request.url).pathname === "/refuse") return false;
  const protocol = request.headers.get("sec-websocket-protocol")?.split(",")[0]?.trim();
  return server.upgrade(request, {
    headers: protocol === undefined ? {} : { "sec-websocket-protocol": protocol },
  });
}

const server = Bun.serve({
  unix: socket,
  maxRequestBodySize: 64 * 1024 * 1024,
  fetch(request, upgrading) {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return servePage({ request, url: new URL(request.url), folder: flags.folder() ?? "" });
    }
    return upgrade(request, upgrading) ? undefined : new Response("no", { status: 400 });
  },
  websocket: {
    message(ws, message) {
      if (message === "close-now") ws.close(4001, "closed by code-server");
      else ws.send(message);
    },
  },
});

chmodSync(socket, Number.parseInt(flags.value("--socket-mode") ?? "600", 8));
process.on("SIGTERM", () => {
  helper.kill();
  void server.stop(true);
  process.exit(0);
});
