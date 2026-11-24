import { TERMINAL_PROTOCOL } from "@agentcontrol/protocol";
import { createClient } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { onTestEnd } from "./cleanup.ts";
import { type OpenShell, openShell } from "./terminal-user.ts";

/**
 * A terminal opened against something that is not the app: it answers the first message with a
 * line that is not JSON, then prints "hello" and ends the shell with code 0.
 */
export function openShellOnAnAppThatSendsAFrameThatIsNotJson(
  app: AppAccess,
  call: { session: Session },
): OpenShell {
  const server = Bun.serve({
    port: 0,
    fetch: (request, bun) => {
      const headers = { "Sec-WebSocket-Protocol": TERMINAL_PROTOCOL };
      return bun.upgrade(request, { headers }) ? undefined : new Response("no", { status: 426 });
    },
    websocket: {
      message: (socket) => {
        socket.send("this is not json");
        socket.send(JSON.stringify({ type: "data", data: "hello\r\n" }));
        socket.send(JSON.stringify({ type: "exit", exitCode: 0 }));
      },
    },
  });
  onTestEnd(() => server.stop(true));
  const sdk = createClient({ baseUrl: `http://127.0.0.1:${String(server.port)}`, token: "any" });
  return openShell(app, { session: call.session, sdk });
}
