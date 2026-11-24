import { RotateCcw } from "lucide-react";

/**
 * Shown above the composer when the relay stopped while the session's agent was running: the agent
 * is gone. Resume starts a new one in the same folder; replying does the same.
 */
export function InterruptedBanner(props: { onResume: () => void; resuming: boolean }) {
  const { onResume, resuming } = props;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-t border-line bg-code px-4 py-3 text-xs text-muted"
    >
      <RotateCcw className="size-4 flex-none" />
      <span className="flex-1">The agent is not running. Resume it, or just reply.</span>
      <button
        type="button"
        onClick={onResume}
        disabled={resuming}
        className="rounded-md border border-line bg-surface px-2.5 py-1 font-medium text-fg hover:bg-code disabled:opacity-50"
      >
        {resuming ? "Resuming…" : "Resume"}
      </button>
    </div>
  );
}
