import { type RefObject, useEffect, useRef, useState } from "react";
import { languageOf } from "./language-of.ts";
import { type Monaco, useMonaco } from "./use-monaco.ts";

type CodeEditor = ReturnType<Monaco["editor"]["create"]>;

export type CodeEditorOptions = {
  path: string;
  content: string;
  readOnly: boolean;
  onSave: (content: string) => void;
};

function useCreatedEditor(host: RefObject<HTMLDivElement | null>, o: CodeEditorOptions) {
  const monaco = useMonaco();
  const [editor, setEditor] = useState<CodeEditor>();
  useEffect(() => {
    if (!monaco || !host.current) return;
    const model = monaco.editor.createModel(o.content, languageOf(o.path));
    const created = monaco.editor.create(host.current, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
    });
    setEditor(created);
    return () => {
      created.dispose();
      model.dispose();
    };
    // The editor is rebuilt only when the file changes; content and options sync below.
  }, [monaco, o.path]);
  return { monaco, editor };
}

/** Mounts a Monaco editor on `host`; Cmd/Ctrl+S calls `onSave` with the current text. */
export function useCodeEditor(host: RefObject<HTMLDivElement | null>, options: CodeEditorOptions) {
  const { monaco, editor } = useCreatedEditor(host, options);
  const onSave = useRef(options.onSave);
  onSave.current = options.onSave;
  useEffect(() => {
    if (editor && editor.getValue() !== options.content) editor.setValue(options.content);
  }, [editor, options.content]);
  useEffect(() => {
    editor?.updateOptions({ readOnly: options.readOnly });
  }, [editor, options.readOnly]);
  useEffect(() => {
    if (!monaco || !editor) return;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave.current(editor.getValue());
    });
  }, [monaco, editor]);
}
