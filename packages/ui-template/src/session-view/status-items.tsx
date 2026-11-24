import type { ItemOf } from "./view-items.ts";

export function TurnEnded({ item }: { item: ItemOf<"turn-ended"> }) {
  return <div className="text-center text-[11px] text-muted">Turn ended · {item.stopReason}</div>;
}

function exitText({ exitCode, signal }: ItemOf<"agent-exited">): string {
  if (signal === "SIGTERM")
    return "The agent was stopped (signal SIGTERM), as when a session is archived.";
  if (signal) return `The agent exited (signal ${signal})`;
  return `The agent exited (exit code ${String(exitCode ?? "unknown")})`;
}

export function AgentExited({ item }: { item: ItemOf<"agent-exited"> }) {
  return (
    <div className="rounded-lg border border-line bg-del-bg px-2.5 py-1.5 text-xs text-del-fg">
      {exitText(item)}
    </div>
  );
}

export function ModeLine({ item }: { item: ItemOf<"mode"> }) {
  return <div className="font-mono text-[11px] text-muted">Mode: {item.modeId}</div>;
}

export function Notice({ item }: { item: ItemOf<"notice"> }) {
  return <div className="text-center text-[11px] text-muted">{item.text}</div>;
}
