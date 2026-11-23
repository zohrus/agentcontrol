import type { ChangeProgress } from "./types.ts";

function FailureNote({ change }: { change: ChangeProgress }) {
  if (change.status !== "failed" || !change.failure) return null;
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <p className="m-0 text-fail">{change.failure}</p>
      {change.checkOutput && (
        <pre className="m-0 max-h-32 overflow-auto rounded-md bg-code p-2 font-mono text-[11px]">
          {change.checkOutput}
        </pre>
      )}
    </div>
  );
}

function ChangedFiles({ files }: { files: readonly string[] }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-muted">Changed files</span>
      <ul aria-label="Changed files" className="m-0 list-none p-0 font-mono text-[11px]">
        {files.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
    </div>
  );
}

/** What the change did or why it failed: shown above the status line while it matters. */
export function ChangeDetails({ change }: { change: ChangeProgress }) {
  if (change.status !== "failed" && change.status !== "ready") return null;
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-2.5">
      <FailureNote change={change} />
      <ChangedFiles files={change.changedFiles} />
    </div>
  );
}
