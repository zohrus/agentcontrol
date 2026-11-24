import { RelayName as N, type SessionId } from "@agentcontrol/protocol";
import type { Server, ServerWebSocket, WebSocketHandler } from "bun";
import type { IdeSignal, Link } from "../sync/index.ts";
import { forwardedHeaders } from "./request.ts";

/** What Bun keeps with each WebSocket of the IDE's origin. */
export interface IdeSocketData {
  bridge: SocketBridge;
}

/** The most the browser may have queued toward the workspace, and the most queued toward the browser. */
const MAX_QUEUED_BYTES = 32 * 1024 * 1024;
const CLOSE_NORMAL = 1000;
const CLOSE_TOO_BIG = 1009;
const CLOSE_INTERNAL = 1011;
const CLOSE_OVERLOADED = 1013;

/** A close code a server may send: 1005, 1006 and 1015 only ever describe what a peer saw. */
const sendable = (code: number): number =>
  code >= 1000 && ![1004, 1005, 1006, 1015].includes(code) && code < 5000 ? code : CLOSE_NORMAL;

/**
 * One browser WebSocket and the WebSocket the relay holds open to code-server. Messages from the
 * browser are passed on one at a time, in order. Nothing is ever dropped: a side that falls too far
 * behind ends the socket instead.
 */
class SocketBridge {
  private ws: ServerWebSocket<IdeSocketData> | undefined;
  /** What code-server said before the browser's socket was open. */
  private early: IdeSignal[] = [];
  private queued = 0;
  private stopListening: () => void = () => undefined;

  constructor(private readonly call: { link: Link; tunnelId: string }) {}

  /** Starts listening for what the relay reports; must come before the relay is asked to open. */
  listen(): void {
    this.stopListening = this.call.link.onIde(this.call.tunnelId, (signal) => {
      this.hear(signal);
    });
  }

  /** The browser's socket is open: what arrived meanwhile is delivered first. */
  attach(ws: ServerWebSocket<IdeSocketData>): void {
    this.ws = ws;
    this.early.splice(0).forEach((signal) => {
      this.hear(signal);
    });
  }

  /** A message from the browser, to be sent on in order. */
  fromBrowser(message: string | Buffer): void {
    const bytes = typeof message === "string" ? Buffer.byteLength(message) : message.length;
    this.queued += bytes;
    if (this.queued > MAX_QUEUED_BYTES) {
      this.end(CLOSE_TOO_BIG, "too much data waiting for the workspace");
      return;
    }
    const data = Buffer.from(message).toString("base64");
    const params = { tunnelId: this.call.tunnelId, data, binary: typeof message !== "string" };
    // Calls are issued in order and the link keeps their order, so none waits for another's answer.
    this.call.link
      .call(N.ideSocketSend, params)
      .catch(() => {
        this.end(CLOSE_INTERNAL, "the workspace did not take the message");
      })
      .finally(() => {
        this.queued -= bytes;
      });
  }

  /** The browser's socket ended: the relay closes its side. */
  browserClosed(): void {
    this.stopListening();
    void this.call.link.call(N.ideClose, { tunnelId: this.call.tunnelId }).catch(() => undefined);
  }

  /** The relay never opened the socket, or the upgrade failed: nothing is left to listen to. */
  abandon(): void {
    this.browserClosed();
  }

  private hear(signal: IdeSignal): void {
    const { ws } = this;
    if (ws === undefined) {
      this.early.push(signal);
    } else if (signal.type === "message") {
      this.toBrowser(ws, signal);
    } else if (signal.type === "closed") {
      this.stopListening();
      ws.close(sendable(signal.code), signal.reason);
    } else if (signal.type === "lost") {
      this.end(CLOSE_INTERNAL, "the connection to the workspace was lost");
    }
  }

  private toBrowser(
    ws: ServerWebSocket<IdeSocketData>,
    signal: IdeSignal & { type: "message" },
  ): void {
    if (ws.getBufferedAmount() > MAX_QUEUED_BYTES) {
      this.end(CLOSE_OVERLOADED, "the browser is too slow to take the data");
      return;
    }
    ws.send(signal.binary ? signal.data : signal.data.toString("utf8"));
  }

  private end(code: number, reason: string): void {
    this.browserClosed();
    this.ws?.close(code, reason);
  }
}

/** Bun's WebSocket handlers for the IDE's origin: each socket is one bridge into a code-server. */
export const ideWebsocket: WebSocketHandler<IdeSocketData> = {
  maxPayloadLength: 64 * 1024 * 1024,
  open(ws) {
    ws.data.bridge.attach(ws);
  },
  message(ws, message) {
    ws.data.bridge.fromBrowser(message);
  },
  close(ws) {
    ws.data.bridge.browserClosed();
  },
};

/**
 * Opens the WebSocket in code-server first, then accepts the browser's, answering with the
 * subprotocol code-server chose. Undefined when anything fails on the way: the caller refuses.
 */
export async function upgradeToIde(call: {
  server: Server<IdeSocketData>;
  request: Request;
  link: Link;
  sessionId: SessionId;
  path: string;
}): Promise<boolean> {
  const { server, request, link, sessionId, path } = call;
  const tunnelId = crypto.randomUUID();
  const bridge = new SocketBridge({ link, tunnelId });
  bridge.listen();
  const wanted = (request.headers.get("sec-websocket-protocol") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  const headers = forwardedHeaders(request.headers);
  try {
    const { protocol } = await link.call(N.ideSocketOpen, {
      ...{ sessionId, tunnelId, path, headers },
      protocols: wanted,
    });
    const answer = protocol === "" ? {} : { "sec-websocket-protocol": protocol };
    if (server.upgrade(request, { data: { bridge }, headers: answer })) return true;
  } catch {
    // The relay refused or the connection is down: the browser gets a plain refusal.
  }
  bridge.abandon();
  return false;
}
