import type { DiffFile } from "@agentcontrol/protocol";
import { cn } from "../components/index.ts";

type Props = {
  files: readonly DiffFile[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
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
export function FileList({ files, selectedPath, onSelect }: Props) {
  return (
    <ul className="m-0 flex max-h-40 list-none flex-col gap-0.5 overflow-y-auto border-b border-line p-2">
      {files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() => {
              onSelect(file.path);
            }}
            className={cn(
              "flex w-full gap-2 rounded px-1.5 py-0.5 text-left font-mono text-[11px]",
              file.path === selectedPath && "bg-accent-soft",
            )}
          >
            <span className="truncate">{file.path}</span>
            <Counts file={file} />
          </button>
        </li>
      ))}
    </ul>
  );
}
