import type { FileChange } from "@agentcontrol/protocol";

const MAX_LINES = 30;

function linesOf(text: string | undefined): string[] {
  return text === undefined || text === "" ? [] : text.split("\n");
}

type LinesProps = { lines: string[]; sign: "+" | "−" };

function Lines({ lines, sign }: LinesProps) {
  const className = sign === "+" ? "bg-add-bg text-add-fg" : "bg-del-bg text-del-fg";
  return (
    <>
      {lines.slice(0, MAX_LINES).map((line, index) => (
        <div key={`${sign}${String(index)}`} className={className}>
          {sign} {line}
        </div>
      ))}
      {lines.length > MAX_LINES && (
        <div className="text-muted">… {lines.length - MAX_LINES} more lines</div>
      )}
    </>
  );
}

/** What one file changes: the lines removed, then the lines added; only counts when no text came. */
export function FileDiff({ change }: { change: FileChange }) {
  return (
    <div className="flex flex-col gap-1">
      <code className="truncate font-mono text-xs text-muted">{change.path}</code>
      {"additions" in change ? (
        <span className="font-mono text-xs">
          +{change.additions} −{change.deletions}
        </span>
      ) : (
        <div className="max-h-60 overflow-auto rounded-md border border-line font-mono text-xs">
          <Lines lines={linesOf(change.oldText)} sign="−" />
          <Lines lines={linesOf(change.newText)} sign="+" />
        </div>
      )}
    </div>
  );
}
