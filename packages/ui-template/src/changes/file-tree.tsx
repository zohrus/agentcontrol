import type { FsEntry } from "@agentcontrol/protocol";
import { useState } from "react";
import { cn, inputClass } from "../components/index.ts";

const MAX_SHOWN = 200;

type Props = {
  entries: readonly FsEntry[];
  selectedPath: string | undefined;
  onSelect: (path: string) => void;
};

/** The files whose name contains the filter: the first MAX_SHOWN to list, and how many there are. */
function matching(entries: readonly FsEntry[], filter: string) {
  const wanted = filter.trim().toLowerCase();
  const files = entries.filter((entry) => entry.kind === "file");
  const found = files.filter((entry) => entry.path.toLowerCase().includes(wanted));
  return { shown: found.slice(0, MAX_SHOWN), total: found.length };
}

function FileRow({
  path,
  selected,
  onSelect,
}: {
  path: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-[11px]",
          selected && "bg-accent-soft",
        )}
      >
        {path}
      </button>
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
export function FileTree({ entries, selectedPath, onSelect }: Props) {
  const [filter, setFilter] = useState("");
  const { shown, total } = matching(entries, filter);
  return (
    <div className="flex flex-col gap-1.5 border-b border-line p-2">
      <FilterInput value={filter} onChange={setFilter} />
      <ul
        data-testid="file-tree"
        className="m-0 flex max-h-32 list-none flex-col overflow-y-auto p-0"
      >
        {shown.map(({ path }) => (
          <FileRow
            key={path}
            path={path}
            selected={path === selectedPath}
            onSelect={() => {
              onSelect(path);
            }}
          />
        ))}
      </ul>
      {total > shown.length && (
        <p data-testid="file-tree-notice" className="m-0 text-[11px] text-muted">
          Showing {shown.length} of {total.toLocaleString("en-US")} files. Filter to find the rest.
        </p>
      )}
    </div>
  );
}
