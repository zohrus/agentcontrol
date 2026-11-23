import type { FsEntry } from "@agentcontrol/protocol";
import { cn } from "../components/index.ts";
import { previewKindOf } from "./kind.ts";

const MAX_SHOWN = 50;

type Props = {
  tree: readonly FsEntry[];
  /** Said first: why nothing is shown yet. */
  intro: string;
  onPick: (path: string) => void;
};

/** What there is to preview in the worktree: its HTML and Markdown files. */
function previewable(tree: readonly FsEntry[]): string[] {
  const files = tree.filter((entry) => entry.kind === "file" && previewKindOf(entry.path));
  return files.map((entry) => entry.path).slice(0, MAX_SHOWN);
}

/** The Preview tab when no previewable file is selected: says why, and offers the ones there are. */
export function PreviewPicker({ tree, intro, onPick }: Props) {
  const paths = previewable(tree);
  return (
    <div data-testid="preview-picker" className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <p className="m-0 text-xs text-muted">
        {paths.length === 0 ? `${intro} This session has no HTML or Markdown files yet.` : intro}
      </p>
      <ul className="m-0 flex list-none flex-col overflow-y-auto p-0">
        {paths.map((path) => (
          <li key={path}>
            <button
              type="button"
              onClick={() => {
                onPick(path);
              }}
              className={cn(
                "w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-[11px]",
              )}
            >
              {path}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
