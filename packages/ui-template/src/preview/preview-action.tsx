import { previewKindOf } from "./kind.ts";

type Props = { path: string; onPreview: (path: string) => void };

/** A small "Preview" button for a file row; absent for files that cannot be previewed. */
export function PreviewAction({ path, onPreview }: Props) {
  if (previewKindOf(path) === undefined) return null;
  return (
    <button
      type="button"
      aria-label={`Preview ${path}`}
      onClick={() => {
        onPreview(path);
      }}
      className="flex-none rounded border border-line px-1.5 text-[10px] text-muted hover:bg-code hover:text-fg"
    >
      Preview
    </button>
  );
}
