import type { ConfigFileChange } from "@agentcontrol/protocol";
import { DiffViewer } from "../changes/index.ts";

const actionNames: Record<ConfigFileChange["action"], string> = {
  create: "New file",
  update: "Changed",
  delete: "Removed",
};

const LINE_PX = 19;
const MIN_PX = 80;
const MAX_PX = 280;

const lineCount = (text: string | undefined): number => (text ?? "").split("\n").length;

/** Tall enough to show the whole change, within reason. */
function heightOf(change: ConfigFileChange): number {
  const lines = lineCount(change.before) + lineCount(change.after);
  return Math.min(MAX_PX, Math.max(MIN_PX, lines * LINE_PX));
}

/** One file the plan would write: its path, what happens to it, and its text before and after. */
export function FileChangeCard({ change }: { change: ConfigFileChange }) {
  return (
    <section
      aria-label={change.path}
      className="flex flex-col gap-1.5 rounded-lg border border-line p-2"
    >
      <div className="flex items-baseline gap-2">
        <code className="truncate font-mono text-xs">{change.path}</code>
        <span className="ml-auto text-[11px] text-muted">{actionNames[change.action]}</span>
      </div>
      <div className="flex flex-col" style={{ height: heightOf(change) }}>
        <DiffViewer path={change.path} base={change.before ?? ""} working={change.after ?? ""} />
      </div>
    </section>
  );
}
