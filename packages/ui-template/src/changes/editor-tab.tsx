import { useRef } from "react";
import { useCodeEditor } from "./use-code-editor.ts";

export type EditorTabProps = {
  path: string;
  content: string;
  readOnly: boolean;
  /** A save was asked for and the app has not answered yet. */
  saving?: boolean | undefined;
  onSave: (content: string) => void;
};

/** One worktree file in Monaco. Cmd/Ctrl+S calls `onSave`; `readOnly` locks it. */
export function EditorTab({ path, content, readOnly, saving, onSave }: EditorTabProps) {
  const host = useRef<HTMLDivElement>(null);
  useCodeEditor(host, { path, content, readOnly, onSave });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-3 py-1.5 font-mono text-[11px] text-muted">
        {path}
        {readOnly && " · read-only while the agent runs"}
        {saving === true && <span role="status"> · Saving…</span>}
      </div>
      <div ref={host} data-testid="code-editor" className="min-h-0 flex-1" />
    </div>
  );
}
