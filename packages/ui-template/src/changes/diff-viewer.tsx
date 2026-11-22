import { useEffect, useRef } from "react";
import { languageOf } from "./language-of.ts";
import { useMonaco } from "./use-monaco.ts";

export type DiffViewerProps = { path: string; base: string; working: string };

/** Monaco diff editor, inline, showing the base version against the working copy. */
export function DiffViewer({ path, base, working }: DiffViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const monaco = useMonaco();
  useEffect(() => {
    if (!monaco || !host.current) return;
    const language = languageOf(path);
    const original = monaco.editor.createModel(base, language);
    const modified = monaco.editor.createModel(working, language);
    const editor = monaco.editor.createDiffEditor(host.current, {
      readOnly: true,
      renderSideBySide: false,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
    });
    editor.setModel({ original, modified });
    return () => {
      editor.dispose();
      original.dispose();
      modified.dispose();
    };
  }, [monaco, path, base, working]);
  return <div ref={host} data-testid="diff-viewer" className="min-h-0 flex-1" />;
}
