import { cn } from "../components/index.ts";

export type ConnectionState = "connected" | "reconnecting" | "offline";

const labels: Record<ConnectionState, string> = {
  connected: "Connected",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

const dots: Record<ConnectionState, string> = {
  connected: "bg-done",
  reconnecting: "bg-wait animate-pulse",
  offline: "bg-fail",
};

/** The app's link to the relay, for the status bar. */
export function ConnectionIndicator({ state }: { state: ConnectionState }) {
  return (
    <span role="status" className="flex items-center gap-1.5">
      <i aria-hidden="true" className={cn("inline-block size-2 rounded-full", dots[state])} />
      {labels[state]}
    </span>
  );
}
