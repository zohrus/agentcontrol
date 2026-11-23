import { type SessionId, TERMINAL_PROTOCOL, TOKEN_PROTOCOL_PREFIX } from "@agentcontrol/protocol";
import { listen, whyRefused } from "./terminal-listen.ts";
import type { OpenTerminal, Terminal, TerminalConnection } from "./terminal-types.ts";

export type { OpenTerminal, Terminal };

interface Place {
  location?: { protocol: string; host: string };
}

/** `http://host/api/sessions/<id>/terminal` for an app at `baseUrl` ("" means this page's own app). */
function terminalAddress(call: { baseUrl: string; id: SessionId }): string {
  const { location } = globalThis as Place;
  const origin =
    call.baseUrl === "" && location ? `${location.protocol}//${location.host}` : call.baseUrl;
  return `${origin}/api/sessions/${encodeURIComponent(call.id)}/terminal`;
}

/** Sends what is given; what comes before the socket is ready waits, and goes first, in order. */
function sender(socket: WebSocket, first: object): (message: object) => void {
  const waiting: string[] = [JSON.stringify(first)];
  socket.addEventListener("open", () => {
    waiting.splice(0).forEach((text) => {
      socket.send(text);
    });
  });
  return (message) => {
    const text = JSON.stringify(message);
    if (socket.readyState === WebSocket.OPEN) socket.send(text);
    else if (socket.readyState === WebSocket.CONNECTING) waiting.push(text);
  };
}

/**
 * Opens a shell in the session's folder, on its workspace (this Mac or an ssh host), and connects
 * it to the callbacks. It is the user's own console, not the agent's. Work typed before the
 * connection is ready is kept and sent in order. Throws if there is no secret to send.
 */
function openTerminal(call: {
  connection: TerminalConnection;
  id: SessionId;
  options: OpenTerminal;
}): Terminal {
  const { connection, id, options } = call;
  const token = connection.token();
  if (token === undefined) throw new Error("There is no app secret to open a terminal with.");
  // The secret rides as a second subprotocol: a browser cannot set headers on a WebSocket, and
  // the address is logged. The app selects the first one and never echoes the secret.
  const protocols = [TERMINAL_PROTOCOL, `${TOKEN_PROTOCOL_PREFIX}${token}`];
  const address = terminalAddress({ baseUrl: connection.baseUrl, id });
  const socket = new WebSocket(address.replace(/^http/, "ws"), protocols);
  const send = sender(socket, { type: "open", cols: options.cols, rows: options.rows });
  const silence = listen({ socket, options, refused: () => whyRefused({ connection, address }) });
  return {
    write: (data) => {
      send({ type: "input", data });
    },
    resize: (size) => {
      send({ type: "resize", ...size });
    },
    close: () => {
      silence();
      socket.close(1000);
    },
  };
}

/** The terminal part of the client: the same address and secret as every other call. */
export function terminalApi(call: {
  baseUrl: string;
  token: () => string | undefined;
  send: typeof fetch;
}) {
  const { baseUrl, token, send } = call;
  const statusOf = async (url: string): Promise<number> => (await send(url)).status;
  return {
    /**
     * Opens the user's shell in the session's folder on its workspace (a real terminal; this is
     * the user's console, not the agent's). Returns at once: output arrives through `onData`.
     */
    open: (id: SessionId, options: OpenTerminal): Terminal =>
      openTerminal({ connection: { baseUrl, token, statusOf }, id, options }),
  };
}
