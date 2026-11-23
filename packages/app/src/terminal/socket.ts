import type { SessionId } from "@agentcontrol/protocol";
import { TERMINAL_PROTOCOL } from "@agentcontrol/protocol";
import type { Server, ServerWebSocket, WebSocketHandler } from "bun";
import type { Link } from "../sync/index.ts";
import { Bridge } from "./bridge.ts";

/** What Bun keeps with each terminal socket. */
export interface TerminalSocketData {
  link: Link;
  sessionId: SessionId;
  /** Made when the socket opens. */
  bridge?: Bridge;
}

/** The biggest frame the browser may send; typing and resizes are tiny, a paste is not. */
const MAX_FRAME_BYTES = 1024 * 1024;

/** Bun's WebSocket handlers for every terminal socket: each is bridged to one relay terminal. */
export const terminalWebsocket: WebSocketHandler<TerminalSocketData> = {
  maxPayloadLength: MAX_FRAME_BYTES,
  open(ws) {
    const { link, sessionId } = ws.data;
    ws.data.bridge = new Bridge({
      link,
      sessionId,
      send: (message) => {
        ws.send(JSON.stringify(message));
      },
      hangUp: (code, reason) => {
        ws.close(code, reason);
      },
    });
  },
  message(ws: ServerWebSocket<TerminalSocketData>, message) {
    if (typeof message === "string") ws.data.bridge?.receive(message);
    else ws.close(1003, "text frames only");
  },
  close(ws) {
    ws.data.bridge?.close();
  },
};

/** Upgrades the request to a terminal socket; false when it is not a WebSocket request. */
export function upgradeToTerminal(call: {
  server: Server<TerminalSocketData>;
  request: Request;
  data: TerminalSocketData;
}): boolean {
  const { server, request, data } = call;
  // Select our own subprotocol only: the other one offered carries the secret and is never echoed.
  const headers = { "sec-websocket-protocol": TERMINAL_PROTOCOL };
  return server.upgrade(request, { data, headers });
}
