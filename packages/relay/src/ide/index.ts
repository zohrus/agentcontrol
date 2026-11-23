import {
  ErrorCode,
  IDE_WINDOW_BYTES,
  type IdeRequestParams,
  type IdeRequestResult,
  type IdeSocketOpenParams,
  type IdeStatusResult,
  type SessionId,
} from "@agentcontrol/protocol";
import type { HostEnv } from "../agents/index.ts";
import { type Client, RelayError } from "../rpc/index.ts";
import { detectCodeServer } from "./detect.ts";
import { passableHeaders, pumpBody, requestUpstream } from "./http.ts";
import { Servers, type StartCall } from "./servers.ts";
import { openUpstreamSocket } from "./sockets.ts";
import { Tunnels } from "./tunnels.ts";
import { createWindow } from "./window.ts";

export { codeServerStep } from "./detect.ts";

const notRunning = (): RelayError =>
  new RelayError(ErrorCode.invalidParams, "No code-server is running for this session.");

/**
 * Browser VS Code: one code-server per session on a private unix socket, and the tunnel that
 * carries the browser's HTTP requests and WebSockets to it over the relay's own link.
 */
export class Ide {
  private readonly servers: Servers;
  private readonly tunnels = new Tunnels();

  constructor(private readonly options: { dataDir: string; env: HostEnv }) {
    this.servers = new Servers(options);
  }

  async status(sessionId: SessionId): Promise<IdeStatusResult> {
    const found = await detectCodeServer(this.options.env);
    const running = this.servers.isRunning(sessionId);
    return { installed: found !== undefined, running, ...(found && { version: found.version }) };
  }

  isRunning(sessionId: SessionId): boolean {
    return this.servers.isRunning(sessionId);
  }

  start(call: StartCall): Promise<void> {
    return this.servers.start(call);
  }

  /** Ends the session's code-server and every request and WebSocket into it. */
  async stop(sessionId: SessionId): Promise<void> {
    this.tunnels.closeWhere((tunnel) => tunnel.sessionId === sessionId);
    await this.servers.stop(sessionId);
  }

  async stopAll(): Promise<void> {
    this.tunnels.closeWhere(() => true);
    await this.servers.stopAll();
  }

  /** Sends one HTTP request in; the body of the answer follows as notifications to the client. */
  async request(call: { client: Client; params: IdeRequestParams }): Promise<IdeRequestResult> {
    const { client, params } = call;
    const { sessionId, tunnelId } = params;
    const socketPath = this.servers.socketOf(sessionId) ?? this.refuse();
    const { window, signal } = this.addRequestTunnel(call);
    try {
      const response = await requestUpstream({ socketPath, request: params, signal });
      void pumpBody({ response, tunnelId, window, client }).finally(() => {
        this.tunnels.release(tunnelId);
      });
      return { status: response.status, headers: passableHeaders(response.headers) };
    } catch (error) {
      this.tunnels.release(tunnelId);
      const reason = error instanceof Error ? error.message : String(error);
      throw new RelayError(ErrorCode.internalError, `code-server did not answer: ${reason}`);
    }
  }

  /** The app handed `bytes` of the response on. Late acknowledgements of a finished request are fine. */
  ack(call: { client: Client; tunnelId: string; bytes: number }): void {
    this.tunnels.of({ id: call.tunnelId, client: call.client })?.window.give(call.bytes);
  }

  /** Ends a request or WebSocket whose browser went away. */
  close(call: { client: Client; tunnelId: string }): void {
    const tunnel = this.tunnels.of({ id: call.tunnelId, client: call.client });
    tunnel?.close();
    this.tunnels.release(call.tunnelId);
  }

  /** Opens a WebSocket into the session's code-server; messages come back as notifications. */
  async openSocket(call: {
    client: Client;
    params: IdeSocketOpenParams;
  }): Promise<{ protocol: string }> {
    const { client, params } = call;
    const { sessionId, tunnelId } = params;
    const socketPath = this.servers.socketOf(sessionId) ?? this.refuse();
    const over = this.servers.connection(sessionId);
    try {
      const socket = await openUpstreamSocket({
        socketPath,
        params,
        client,
        onClosed: () => {
          this.tunnels.release(tunnelId);
        },
      });
      const { send, close } = socket;
      const window = createWindow(0);
      this.tunnels.add(tunnelId, { owner: client, sessionId, window, send, close, over });
      return { protocol: socket.protocol };
    } catch (error) {
      over();
      throw error instanceof RelayError
        ? error
        : new RelayError(ErrorCode.internalError, "code-server refused the WebSocket.");
    }
  }

  /** A message from the browser into its WebSocket. */
  sendSocket(call: { client: Client; tunnelId: string; data: string; binary: boolean }): void {
    const tunnel = this.tunnels.of({ id: call.tunnelId, client: call.client });
    if (tunnel?.send === undefined) {
      throw new RelayError(ErrorCode.invalidParams, `No WebSocket "${call.tunnelId}".`);
    }
    tunnel.send(call);
  }

  private addRequestTunnel(call: { client: Client; params: IdeRequestParams }) {
    const { client, params } = call;
    const abort = new AbortController();
    const window = createWindow(IDE_WINDOW_BYTES);
    const over = this.servers.connection(params.sessionId);
    const close = (): void => {
      abort.abort();
    };
    this.tunnels.add(params.tunnelId, {
      owner: client,
      sessionId: params.sessionId,
      window,
      close,
      over,
    });
    return { window, signal: abort.signal };
  }

  private refuse(): never {
    throw notRunning();
  }
}
