import type { FsEntry } from "@agentcontrol/protocol";
import { useState } from "react";
import { cn, inputClass } from "../components/index.ts";
import { PreviewAction } from "../preview/index.ts";

const MAX_SHOWN = 200;

type Props = {
  entries: readonly FsEntry[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
  onPreview: (path: string) => void;
};

function matching(entries: readonly FsEntry[], filter: string): FsEntry[] {
  const wanted = filter.trim().toLowerCase();
  const files = entries.filter((entry) => entry.kind === "file");
  return files.filter((entry) => entry.path.toLowerCase().includes(wanted)).slice(0, MAX_SHOWN);
}

function FileRow({
  path,
  selected,
  onSelect,
  onPreview,
}: {
  path: string;
  selected: boolean;
  onSelect: () => void;
  onPreview: (path: string) => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-left font-mono text-[11px]",
          selected && "bg-accent-soft",
        )}
      >
        {path}
      </button>
      <PreviewAction path={path} onPreview={onPreview} />
    </li>
  );
}

function FilterInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <input
      aria-label="Filter files"
      placeholder="Filter files"
      className={cn(inputClass, "py-1 text-xs")}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  );
}

/** Every file of the worktree, filterable by name; picking one opens it in the editor. */
export function FileTree({ entries, selectedPath, onSelect, onPreview }: Props) {
  const [filter, setFilter] = useState("");
  return (
    <div className="flex flex-col gap-1.5 border-b border-line p-2">
      <FilterInput value={filter} onChange={setFilter} />
      <ul
        data-testid="file-tree"
        className="m-0 flex max-h-32 list-none flex-col overflow-y-auto p-0"
      >
        {matching(entries, filter).map(({ path }) => (
          <FileRow
            key={path}
            path={path}
            selected={path === selectedPath}
            onPreview={onPreview}
            onSelect={() => {
              onSelect(path);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
