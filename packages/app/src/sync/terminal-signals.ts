import { RelayName, RelayNotifications } from "@agentcontrol/protocol";
import type { RelayClient } from "../relays/index.ts";

/** What a terminal's shell did, as the relay reported it; `lost` means the connection ended. */
export type TerminalSignal =
  | { type: "data"; terminalId: string; data: string }
  | { type: "exit"; terminalId: string; exitCode: number | null }
  | { type: "lost" };

type Listener = (signal: TerminalSignal) => void;

/** Who listens to the terminals of one workspace's relay connections. */
export function terminalSignals() {
  const listeners = new Set<Listener>();
  const tell = (signal: TerminalSignal): void => {
    [...listeners].forEach((listener) => {
      listener(signal);
    });
  };
  return {
    /** Calls the listener with every signal from now on; returns how to stop. */
    listen: (listener: Listener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Passes on the terminal notifications of this connection. */
    forward: (client: RelayClient): void => {
      client.onNotification(({ method, params }) => {
        if (method === RelayName.terminalData) {
          tell({ type: "data", ...RelayNotifications[RelayName.terminalData].parse(params) });
        } else if (method === RelayName.terminalExit) {
          tell({ type: "exit", ...RelayNotifications[RelayName.terminalExit].parse(params) });
        }
      });
    },
    /** The connection ended, and its terminals with it. */
    lost: (): void => {
      tell({ type: "lost" });
    },
  };
}
