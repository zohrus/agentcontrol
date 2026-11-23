import { ConnectionIndicator, type ConnectionState } from "../status/index.ts";
import type { SlotMap } from "./bar-slots.tsx";

export type StatusStats = {
  waiting: number;
  running: number;
  /** Cost so far today, already formatted, for example "$14.20". */
  today: string;
  /** Names of the connected workspaces. */
  connected: readonly string[];
  /** The app's link to the relay; defaults to "connected". */
  connection?: ConnectionState;
};

function Count({ value, label }: { value: string | number; label: string }) {
  return (
    <span data-testid={`status-${label}`}>
      <b className="font-medium text-fg">{value}</b> {label}
    </span>
  );
}

/** Default status bar slots: waiting, running, cost today and connected workspaces. */
export function defaultStatusBarSlots(stats: StatusStats): SlotMap {
  return {
    waiting: <Count value={stats.waiting} label="waiting" />,
    running: <Count value={stats.running} label="running" />,
    today: <Count value={stats.today} label="today" />,
    connection: <ConnectionIndicator state={stats.connection ?? "connected"} />,
    connections: <span>{stats.connected.map((name) => `${name} connected`).join(" · ")}</span>,
  };
}
