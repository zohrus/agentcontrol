import type { ItemOf } from "./view-items.ts";

function setupHeading(exitCode: number | undefined): string {
  if (exitCode === undefined) return "Setting up the worktree…";
  return exitCode === 0
    ? "Worktree setup finished"
    : `Worktree setup failed (exit ${String(exitCode)})`;
}

export function SetupOutput({ item }: { item: ItemOf<"setup"> }) {
  return (
    <details className="rounded-lg border border-line text-xs" open={item.exitCode !== 0}>
      <summary className="cursor-pointer px-2.5 py-1.5 text-muted">
        {setupHeading(item.exitCode)}
      </summary>
      <pre className="m-0 overflow-x-auto bg-code p-2.5 font-mono text-[11px]">{item.text}</pre>
    </details>
  );
}

export function TurnEnded({ item }: { item: ItemOf<"turn-ended"> }) {
  return <div className="text-center text-[11px] text-muted">Turn ended · {item.stopReason}</div>;
}

function exitText({ exitCode, signal }: ItemOf<"agent-exited">): string {
  if (signal) return `signal ${signal}`;
  return `exit code ${String(exitCode ?? "unknown")}`;
}

export function AgentExited({ item }: { item: ItemOf<"agent-exited"> }) {
  return (
    <div className="rounded-lg border border-line bg-del-bg px-2.5 py-1.5 text-xs text-del-fg">
      The agent exited ({exitText(item)})
    </div>
  );
}

export function ModeLine({ item }: { item: ItemOf<"mode"> }) {
  return <div className="font-mono text-[11px] text-muted">Mode: {item.modeId}</div>;
}

export function Notice({ item }: { item: ItemOf<"notice"> }) {
  return <div className="text-center text-[11px] text-muted">{item.text}</div>;
}
