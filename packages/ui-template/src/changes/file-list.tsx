import type { DiffFile } from "@agentcontrol/protocol";
import { cn } from "../components/index.ts";
import { PreviewAction } from "../preview/index.ts";

type Props = {
  files: readonly DiffFile[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
  onPreview: (path: string) => void;
};

function Counts({ file }: { file: DiffFile }) {
  return (
    <em className="ml-auto flex-none not-italic">
      {file.additions > 0 && <span className="text-add-fg">+{file.additions}</span>}{" "}
      {file.deletions > 0 && <span className="text-del-fg">−{file.deletions}</span>}
    </em>
  );
}

/** Changed files with their +/− counts; the selected one is highlighted. */
export function FileList({ files, selectedPath, onSelect, onPreview }: Props) {
  return (
    <ul
      data-testid="changed-files"
      className="m-0 flex max-h-40 list-none flex-col gap-0.5 overflow-y-auto border-b border-line p-2"
    >
      {files.map((file) => (
        <li key={file.path} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onSelect(file.path);
            }}
            className={cn(
              "flex min-w-0 flex-1 gap-2 rounded px-1.5 py-0.5 text-left font-mono text-[11px]",
              file.path === selectedPath && "bg-accent-soft",
            )}
          >
            <span className="truncate">{file.path}</span>
            <Counts file={file} />
          </button>
          <PreviewAction path={file.path} onPreview={onPreview} />
        </li>
      ))}
    </ul>
  );
}
