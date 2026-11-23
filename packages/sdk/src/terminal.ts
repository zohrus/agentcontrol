import {
  type SessionId,
  TERMINAL_PROTOCOL,
  TerminalServerMessage,
  TOKEN_PROTOCOL_PREFIX,
} from "@agentcontrol/protocol";

/** What a terminal needs to start, and who to tell what happens. */
export interface OpenTerminal {
  /** Size in characters. Send `resize` when the view changes. */
  cols: number;
  rows: number;
  /** The shell's output, as text. Characters are never split between calls. */
  onData(text: string): void;
  /** The shell ended. `exitCode` is null when a signal ended it, or when the terminal was lost. */
  onExit(exitCode: number | null): void;
  /**
   * The terminal could not start or was lost (the workspace went offline, the session was
   * archived, the app refused the connection). The message is plain language. `onExit` follows.
   */
  onError?: ((message: string) => void) | undefined;
}

/** A running terminal. Everything is safe to call after it ended: it does nothing. */
export interface Terminal {
  /** Types text into the shell. */
  write(data: string): void;
  resize(size: { cols: number; rows: number }): void;
  /** Ends the shell and the connection. */
  close(): void;
}

/** What the page needs to find the app and prove who it is. */
export interface TerminalConnection {
  baseUrl: string;
  /** The app's secret; read from the page when left out, like every other call. */
  token: () => string | undefined;
}

interface Place {
  location?: { protocol: string; host: string };
}

/** `ws://host/api/sessions/<id>/terminal` for an app at `baseUrl` ("" means this page's own app). */
function socketAddress(call: { baseUrl: string; id: SessionId }): string {
  const { location } = globalThis as Place;
  const origin =
    call.baseUrl === "" && location ? `${location.protocol}//${location.host}` : call.baseUrl;
  return `${origin.replace(/^http/, "ws")}/api/sessions/${encodeURIComponent(call.id)}/terminal`;
}

function parseMessage(data: unknown): TerminalServerMessage | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const checked = TerminalServerMessage.safeParse(JSON.parse(data));
    return checked.success ? checked.data : undefined;
  } catch {
    return undefined;
  }
}

const REFUSED =
  "The terminal could not connect. The workspace may be offline, or the session archived.";

/** Reports the end of a terminal to the caller once, and nothing after the caller closed it. */
function ending(options: OpenTerminal) {
  let ended = false;
  return {
    end: (exitCode: number | null, problem?: string): void => {
      if (ended) return;
      ended = true;
      if (problem !== undefined) options.onError?.(problem);
      options.onExit(exitCode);
    },
    isOver: (): boolean => ended,
    silence: (): void => {
      ended = true;
    },
  };
}

/** Turns a socket's messages into the caller's callbacks; returns how to silence them. */
function listen(socket: WebSocket, options: OpenTerminal): () => void {
  const { end, isOver, silence } = ending(options);
  const handlers = {
    data: (message: { data: string }) => {
      options.onData(message.data);
    },
    exit: (message: { exitCode: number | null }) => {
      end(message.exitCode);
    },
    error: (message: { message: string }) => {
      end(null, message.message);
    },
  };
  socket.addEventListener("message", (event: MessageEvent) => {
    const message = isOver() ? undefined : parseMessage(event.data);
    if (message) handlers[message.type](message as never);
  });
  socket.addEventListener("close", () => {
    end(null, REFUSED);
  });
  return silence;
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
export function openTerminal(call: {
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
  const socket = new WebSocket(socketAddress({ baseUrl: connection.baseUrl, id }), protocols);
  const send = sender(socket, { type: "open", cols: options.cols, rows: options.rows });
  const silence = listen(socket, options);
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
