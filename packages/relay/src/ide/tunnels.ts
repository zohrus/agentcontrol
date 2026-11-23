import { ErrorCode, type SessionId } from "@agentcontrol/protocol";
import { type Client, RelayError } from "../rpc/index.ts";
import type { Window } from "./window.ts";

/** One request or WebSocket going into a code-server, on behalf of one client. */
export interface Tunnel {
  owner: Client;
  sessionId: SessionId;
  /** Acknowledgements of response bytes (requests only). */
  window: Window;
  /** Sends a message from the browser into the WebSocket (sockets only). */
  send?: (call: { data: string; binary: boolean }) => void;
  /** Ends the request or WebSocket. */
  close: () => void;
  /** Told once when the tunnel is over, whoever ended it. */
  over: () => void;
}

/** The open tunnels of one relay. A tunnel belongs to the client that opened it. */
export class Tunnels {
  private readonly table = new Map<string, Tunnel>();
  private readonly watched = new WeakSet<Client>();

  add(id: string, tunnel: Tunnel): void {
    if (this.table.has(id)) {
      throw new RelayError(ErrorCode.invalidParams, `Tunnel "${id}" is already open.`);
    }
    this.table.set(id, tunnel);
    this.endWith(tunnel.owner);
  }

  /** The client's own tunnel, or undefined (unknown, finished, or another client's). */
  of(call: { id: string; client: Client }): Tunnel | undefined {
    const tunnel = this.table.get(call.id);
    return tunnel?.owner === call.client ? tunnel : undefined;
  }

  /** Forgets the tunnel and tells its owner of it that it is over; does nothing the second time. */
  release(id: string): void {
    const tunnel = this.table.get(id);
    if (tunnel === undefined) return;
    this.table.delete(id);
    tunnel.window.end();
    tunnel.over();
  }

  /** Ends every tunnel that matches. */
  closeWhere(matches: (tunnel: Tunnel) => boolean): void {
    for (const [id, tunnel] of [...this.table]) {
      if (!matches(tunnel)) continue;
      tunnel.close();
      this.release(id);
    }
  }

  /** The connection going away ends its tunnels: nothing outlives the client that opened it. */
  private endWith(client: Client): void {
    if (this.watched.has(client)) return;
    this.watched.add(client);
    client.onClose(() => {
      this.closeWhere((tunnel) => tunnel.owner === client);
    });
  }
}
