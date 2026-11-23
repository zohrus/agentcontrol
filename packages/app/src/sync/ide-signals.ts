import { RelayName as N, RelayNotifications } from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";

/** What happened to one tunnelled request or WebSocket; `lost` means the connection ended. */
export type IdeSignal =
  | { type: "body"; data: Buffer }
  | { type: "end"; error?: string | undefined }
  | { type: "message"; data: Buffer; binary: boolean }
  | { type: "closed"; code: number; reason: string }
  | { type: "lost" };

type Listener = (signal: IdeSignal) => void;
type Routed = { tunnelId: string; signal: IdeSignal };

/** One reader per notification the relay sends about the browser VS Code tunnel. */
const readers: Record<string, (params: unknown) => Routed> = {
  [N.ideBody]: (params) => {
    const { tunnelId, data } = RelayNotifications[N.ideBody].parse(params);
    return { tunnelId, signal: { type: "body", data: Buffer.from(data, "base64") } };
  },
  [N.ideEnd]: (params) => {
    const { tunnelId, error } = RelayNotifications[N.ideEnd].parse(params);
    return { tunnelId, signal: { type: "end", error } };
  },
  [N.ideSocketMessage]: (params) => {
    const { tunnelId, data, binary } = RelayNotifications[N.ideSocketMessage].parse(params);
    return { tunnelId, signal: { type: "message", data: Buffer.from(data, "base64"), binary } };
  },
  [N.ideSocketClosed]: (params) => {
    const { tunnelId, code, reason } = RelayNotifications[N.ideSocketClosed].parse(params);
    return { tunnelId, signal: { type: "closed", code, reason } };
  },
};

/** Who listens to each tunnel of one workspace's relay connections, by the id the app gave it. */
export function ideSignals() {
  const listeners = new Map<string, Listener>();
  return {
    /** Calls the listener with everything about this tunnel from now on; returns how to stop. */
    listen: (tunnelId: string, listener: Listener): (() => void) => {
      listeners.set(tunnelId, listener);
      return () => listeners.delete(tunnelId);
    },
    /** Passes on the tunnel notifications of this connection. */
    forward: (client: RelayClient): void => {
      client.onNotification(({ method, params }) => {
        const read = readers[method];
        if (read === undefined) return;
        const { tunnelId, signal } = read(params);
        listeners.get(tunnelId)?.(signal);
      });
    },
    /** The connection ended, and every tunnel on it. */
    lost: (): void => {
      [...listeners.values()].forEach((listener) => {
        listener({ type: "lost" });
      });
    },
  };
}
