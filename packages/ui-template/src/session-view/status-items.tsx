import { RunningFor } from "./running-for.tsx";
import type { ItemOf } from "./view-items.ts";

/** The line at the end of a turn, running or ended: one height, so one replaces the other in place. */
const turnLine = "flex h-5 items-center justify-center text-[11px] text-muted";

export function TurnEnded({ item }: { item: ItemOf<"turn-ended"> }) {
  return <div className={turnLine}>Turn ended · {item.stopReason}</div>;
}

/** "Working · 12 s": the last row of the stream while a turn runs; the end of the turn replaces it. */
export function Working({ since }: { since: string | undefined }) {
  return (
    <div className={turnLine}>
      Working
      {since !== undefined && (
        <>
          {" · "}
          <RunningFor since={since} />
        </>
      )}
    </div>
  );
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
