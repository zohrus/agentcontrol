import { Plus, Trash2 } from "lucide-react";
import { Button, inputClass } from "../components/index.ts";

type Props = { files: readonly string[]; onChange: (files: string[]) => void };

function replaceAt(list: readonly string[], index: number, value: string): string[] {
  return list.map((item, i) => (i === index ? value : item));
}

function removeAt(list: readonly string[], index: number): string[] {
  return list.filter((_, i) => i !== index);
}

type RowProps = {
  file: string;
  index: number;
  onEdit: (value: string) => void;
  onRemove: () => void;
};

function PatternRow({ file, index, onEdit, onRemove }: RowProps) {
  return (
    <div className="flex gap-1.5">
      <input
        aria-label={`File pattern ${String(index + 1)}`}
        className={`${inputClass} font-mono`}
        value={file}
        onChange={(e) => {
          onEdit(e.target.value);
        }}
      />
      <Button variant="ghost" aria-label={`Remove ${file || "this pattern"}`} onClick={onRemove}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

/** An editable list of file patterns copied into every new worktree. */
export function CopyFilesEditor({ files, onChange }: Props) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1 p-0 text-xs font-medium">Files to copy into each worktree</legend>
      {files.map((file, index) => (
        <PatternRow
          key={`file-${String(index)}`}
          file={file}
          index={index}
          onEdit={(value) => {
            onChange(replaceAt(files, index, value));
          }}
          onRemove={() => {
            onChange(removeAt(files, index));
          }}
        />
      ))}
      <Button
        className="self-start"
        onClick={() => {
          onChange([...files, ""]);
        }}
      >
        <Plus className="size-3.5" /> Add file pattern
      </Button>
    </fieldset>
  );
}
